"""Receipt uploads: accept files fast, then extract in the background."""

import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import List

from fastapi import HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.config import MAX_FILES_PER_UPLOAD, MAX_UPLOAD_BYTES, RECEIPT_DEPLOYMENT
from app.core.database import SessionLocal
from app.core.llm import record_usage
from app.models.receipt import (
    STATUS_FAILED,
    STATUS_NEEDS_REVIEW,
    STATUS_PROCESSING,
    STATUS_READY,
    Receipt,
    ReceiptItem,
)
from app.services import extract_service, quota_service, storage_service

log = logging.getLogger(__name__)

STALE_AFTER = timedelta(minutes=10)


async def accept_uploads(files: List[UploadFile], db: Session, user_id: int) -> List[Receipt]:
    """Validate every file first, then store them and create `processing` receipts."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"At most {MAX_FILES_PER_UPLOAD} files per upload",
        )

    accepted = []
    for f in files:
        name = Path(f.filename or "").name.strip()
        ext = Path(name).suffix.lower()
        if not name or ext not in extract_service.SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": f"Unsupported file '{name or 'unnamed'}'",
                    "accepted": sorted(extract_service.SUPPORTED_EXTENSIONS),
                },
            )
        content = await f.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail={"message": f"File '{name}' is too large", "max_bytes": MAX_UPLOAD_BYTES},
            )
        accepted.append((name, ext, content))

    quota_service.check(db, user_id, "receipts", incoming=len(accepted))
    receipts = []
    for name, ext, content in accepted:
        key = await run_in_threadpool(storage_service.save, user_id, content, ext)
        receipt = Receipt(
            user_id=user_id,
            status=STATUS_PROCESSING,
            image_key=key,
            source_filename=name[:255],
        )
        db.add(receipt)
        receipts.append(receipt)
    db.commit()
    for r in receipts:
        db.refresh(r)
    return receipts


def _is_duplicate(db: Session, receipt: Receipt) -> bool:
    if not (receipt.merchant_name and receipt.receipt_date and receipt.total_amount is not None):
        return False
    return (
        db.query(Receipt.receipt_id)
        .filter(
            Receipt.user_id == receipt.user_id,
            Receipt.receipt_id != receipt.receipt_id,
            Receipt.status != STATUS_FAILED,
            func.lower(Receipt.merchant_name) == receipt.merchant_name.lower(),
            Receipt.receipt_date == receipt.receipt_date,
            Receipt.total_amount == receipt.total_amount,
        )
        .first()
        is not None
    )


def _fail(receipt: Receipt, reason: str) -> None:
    receipt.status = STATUS_FAILED
    receipt.review_reasons = [reason]


def process_receipt(receipt_id: int) -> None:
    """Background job: extract one receipt and set ready / needs_review / failed."""
    db = SessionLocal()
    try:
        receipt = db.get(Receipt, receipt_id)
        if receipt is None or receipt.status != STATUS_PROCESSING:
            return
        try:
            data = storage_service.load(receipt.image_key)
            extracted, usage = extract_service.extract_receipt(
                data, Path(receipt.image_key).suffix
            )
        except extract_service.ExtractionError as e:
            _fail(receipt, str(e))
            db.commit()
            return
        except Exception:
            log.exception("Receipt %s extraction failed", receipt_id)
            _fail(receipt, "processing_error")
            db.commit()
            return

        record_usage(
            db, user_id=receipt.user_id, kind="receipt", deployment=RECEIPT_DEPLOYMENT, usage=usage
        )
        if not extracted.is_receipt:
            _fail(receipt, "not_a_receipt")
            db.commit()
            return

        fields, items, reasons = extract_service.build_receipt_data(extracted, date.today())
        for key, value in fields.items():
            setattr(receipt, key, value)
        receipt.items = [ReceiptItem(**item) for item in items]
        db.flush()
        if _is_duplicate(db, receipt):
            reasons.append("possible_duplicate")

        receipt.status = STATUS_NEEDS_REVIEW if reasons else STATUS_READY
        receipt.review_reasons = reasons or None
        db.commit()
    except Exception:
        log.exception("Receipt %s processing crashed", receipt_id)
        db.rollback()
    finally:
        db.close()


def claim_stale_receipts() -> List[int]:
    """
    Re-claim receipts left in `processing` (e.g. server restarted mid-job).
    Bumping updated_at in the same UPDATE stops another replica claiming them too.
    """
    cutoff = datetime.now(timezone.utc) - STALE_AFTER
    db = SessionLocal()
    try:
        rows = db.execute(
            update(Receipt)
            .where(Receipt.status == STATUS_PROCESSING, Receipt.updated_at < cutoff)
            .values(updated_at=func.now())
            .returning(Receipt.receipt_id)
        ).all()
        db.commit()
        return [r[0] for r in rows]
    finally:
        db.close()
