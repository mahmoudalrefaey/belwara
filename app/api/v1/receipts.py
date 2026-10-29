"""Receipt API endpoints — /receipts and /receipts/upload."""

import mimetypes
from datetime import date
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.config import (
    DEFAULT_RECEIPT_PAGE_SIZE,
    MAX_RECEIPT_PAGE_SIZE,
    SEARCH_RESULTS_CAP,
)
from app.core.dependencies import get_current_user_id, get_db
from app.core.rate_limit import limit_upload
from app.models.receipt import STATUS_FAILED, STATUS_NEEDS_REVIEW, STATUS_PROCESSING
from app.schemas.receipt import (
    DashboardResponse,
    DeleteAllReceiptsBody,
    PaginatedReceiptsResponse,
    ReceiptCreate,
    ReceiptResponse,
    ReceiptSearchResponse,
    ReceiptStatus,
    ReceiptSummary,
    ReceiptUpdate,
    UploadResponse,
)
from app.services import receipt_service, storage_service, upload_service

router = APIRouter(prefix="/receipts", tags=["receipts"])


def _get_owned(db: Session, receipt_id: int, user_id: int):
    receipt = receipt_service.get_receipt_by_id(db, receipt_id, user_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.post("", response_model=ReceiptResponse, status_code=201)
def create_receipt(
    payload: ReceiptCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a receipt manually from a structured JSON payload."""
    return receipt_service.create_receipt(db, user_id, payload)


@router.get("", response_model=PaginatedReceiptsResponse)
def list_receipts(
    limit: int = Query(default=DEFAULT_RECEIPT_PAGE_SIZE, ge=1, le=MAX_RECEIPT_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    status: Optional[ReceiptStatus] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    merchant: Optional[str] = None,
    category: Optional[str] = None,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Paginated receipt list (no line items); use GET /receipts/{id} for items."""
    rows, total = receipt_service.list_receipts_page(
        db, user_id, limit=limit, offset=offset,
        status=status, start=start, end=end, merchant=merchant, category=category,
    )
    return PaginatedReceiptsResponse(items=rows, total=total, limit=limit, offset=offset)


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    currency: Optional[str] = Query(None, max_length=10),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Totals, trends and breakdowns computed in SQL for one currency."""
    return receipt_service.dashboard(db, user_id, currency)


@router.get("/search", response_model=ReceiptSearchResponse)
def search_receipts(
    q: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(default=SEARCH_RESULTS_CAP, ge=1, le=MAX_RECEIPT_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    include_raw: bool = Query(
        default=True,
        description="If false, skip matching on raw_text (faster at scale).",
    ),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Search receipts (capped). Omits line items; use GET /receipts/{id} for detail."""
    rows, total = [], 0
    if q and q.strip():
        rows, total = receipt_service.search_receipts(
            db, q.strip(), user_id, include_raw=include_raw, limit=limit, offset=offset
        )
    return ReceiptSearchResponse(
        items=rows,
        total=total,
        limit=limit,
        offset=offset,
        include_raw_text_in_search=include_raw,
    )


@router.post("/upload", response_model=UploadResponse, status_code=202)
@limit_upload
async def upload_receipts(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Store files and return `processing` receipts at once; extraction runs in the background."""
    receipts = await upload_service.accept_uploads(files, db, user_id)
    for r in receipts:
        background_tasks.add_task(upload_service.process_receipt, r.receipt_id)
    return UploadResponse(message="Receipts are being processed", receipts=receipts)


@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(
    receipt_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return _get_owned(db, receipt_id, user_id)


@router.patch("/{receipt_id}", response_model=ReceiptResponse)
def update_receipt(
    receipt_id: int,
    payload: ReceiptUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Correct a receipt; it becomes `ready` once merchant, date, total and currency are set."""
    receipt = _get_owned(db, receipt_id, user_id)
    if receipt.status == STATUS_PROCESSING:
        raise HTTPException(status_code=409, detail="Receipt is still processing")
    merged = {
        f: getattr(payload, f) if f in payload.model_fields_set else getattr(receipt, f)
        for f in ("merchant_name", "receipt_date", "total_amount", "currency")
    }
    missing = [f for f, v in merged.items() if v is None]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"message": "Required fields are missing", "missing_fields": missing},
        )
    return receipt_service.update_receipt(db, receipt, payload)


@router.post("/{receipt_id}/reprocess", response_model=ReceiptSummary, status_code=202)
def reprocess_receipt(
    receipt_id: int,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Re-run extraction on a failed or flagged receipt (overwrites its extracted fields)."""
    receipt = _get_owned(db, receipt_id, user_id)
    if not receipt.image_key or receipt.status not in (STATUS_FAILED, STATUS_NEEDS_REVIEW):
        raise HTTPException(
            status_code=409, detail="Only failed or needs_review uploads can be reprocessed"
        )
    receipt.status = STATUS_PROCESSING
    receipt.review_reasons = None
    db.commit()
    background_tasks.add_task(upload_service.process_receipt, receipt.receipt_id)
    return receipt


@router.get("/{receipt_id}/image")
def get_receipt_image(
    receipt_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """The original uploaded file (owner only)."""
    receipt = _get_owned(db, receipt_id, user_id)
    if not receipt.image_key:
        raise HTTPException(status_code=404, detail="Receipt has no image")
    media_type = mimetypes.guess_type(receipt.image_key)[0] or "application/octet-stream"
    return Response(
        content=storage_service.load(receipt.image_key),
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.delete("/{receipt_id}")
def delete_receipt(
    receipt_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    if not receipt_service.delete_receipt_by_id(db, receipt_id, user_id):
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"message": "Receipt deleted", "receipt_id": receipt_id}


@router.delete("")
def delete_all_receipts(
    body: DeleteAllReceiptsBody,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete all receipts for the user; requires explicit confirmation in JSON body."""
    deleted = receipt_service.delete_all_receipts(db, user_id)
    return {"message": "Receipts deleted", "deleted": deleted}
