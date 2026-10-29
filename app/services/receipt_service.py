"""Business logic for receipt CRUD, search, and spending aggregates (all scoped to one user)."""

from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Query, Session, selectinload

from app.config import SEARCH_RESULTS_CAP
from app.models.receipt import (
    COUNTED_STATUSES,
    STATUS_NEEDS_REVIEW,
    STATUS_READY,
    Receipt,
    ReceiptItem,
)
from app.schemas.receipt import ReceiptCreate, ReceiptUpdate
from app.services import storage_service


def _day_start(d: date) -> datetime:
    return datetime.combine(d, time(), tzinfo=timezone.utc)


def _filter_receipts(
    q: Query,
    *,
    start: Optional[date] = None,
    end: Optional[date] = None,
    merchant: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
) -> Query:
    """Shared filters; `end` is inclusive."""
    if start:
        q = q.filter(Receipt.receipt_date >= _day_start(start))
    if end:
        q = q.filter(Receipt.receipt_date < _day_start(end + timedelta(days=1)))
    if merchant:
        q = q.filter(Receipt.merchant_name.ilike(f"%{merchant.strip()}%"))
    if category:
        q = q.filter(Receipt.category == category)
    if status:
        q = q.filter(Receipt.status == status)
    return q


def create_receipt(db: Session, user_id: int, payload: ReceiptCreate) -> Receipt:
    receipt = Receipt(
        user_id=user_id,
        status=STATUS_READY,
        merchant_name=payload.merchant_name,
        receipt_date=payload.receipt_date,
        total_amount=payload.total_amount,
        total_taxes=payload.total_taxes,
        other=payload.other,
        currency=payload.currency,
        category=payload.category,
        raw_text=payload.raw_text,
        items=[ReceiptItem(**item.model_dump()) for item in payload.items],
    )
    db.add(receipt)
    db.commit()
    return get_receipt_by_id(db, receipt.receipt_id, user_id)


def update_receipt(db: Session, receipt: Receipt, payload: ReceiptUpdate) -> Receipt:
    """Apply a user correction; the result is trusted, so the receipt becomes ready."""
    data = payload.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in data.items():
        setattr(receipt, key, value)
    if payload.items is not None:
        receipt.items = [ReceiptItem(**item.model_dump()) for item in payload.items]
    receipt.status = STATUS_READY
    receipt.review_reasons = None
    db.commit()
    return get_receipt_by_id(db, receipt.receipt_id, receipt.user_id)


def list_receipts_page(
    db: Session,
    user_id: int,
    *,
    limit: int,
    offset: int,
    start: Optional[date] = None,
    end: Optional[date] = None,
    merchant: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
) -> Tuple[List[Receipt], int]:
    """Paginated receipts for one user; no items loaded."""
    base = _filter_receipts(
        db.query(Receipt).filter(Receipt.user_id == user_id),
        start=start, end=end, merchant=merchant, category=category, status=status,
    )
    total = base.count()
    rows = base.order_by(Receipt.created_at.desc()).offset(offset).limit(limit).all()
    return rows, total


def _search_conditions(term: str, *, include_raw: bool):
    pattern = f"%{term}%"
    parts = [
        Receipt.merchant_name.ilike(pattern),
        Receipt.currency.ilike(pattern),
        ReceiptItem.item_name.ilike(pattern),
    ]
    if include_raw:
        parts.append(Receipt.raw_text.ilike(pattern))
    return or_(*parts)


def search_receipts(
    db: Session,
    term: str,
    user_id: int,
    *,
    include_raw: bool = True,
    limit: int = SEARCH_RESULTS_CAP,
    offset: int = 0,
) -> Tuple[List[Receipt], int]:
    """Substring search; returns (receipts, total_matches)."""
    matching_ids = (
        select(Receipt.receipt_id)
        .outerjoin(Receipt.items)
        .where(Receipt.user_id == user_id, _search_conditions(term, include_raw=include_raw))
    )
    base = db.query(Receipt).filter(Receipt.receipt_id.in_(matching_ids))
    receipts = base.order_by(Receipt.created_at.desc()).offset(offset).limit(limit).all()
    return receipts, base.count()


def get_receipt_by_id(db: Session, receipt_id: int, user_id: int) -> Optional[Receipt]:
    return (
        db.query(Receipt)
        .options(selectinload(Receipt.items))
        .filter(Receipt.receipt_id == receipt_id, Receipt.user_id == user_id)
        .first()
    )


def delete_receipt_by_id(db: Session, receipt_id: int, user_id: int) -> Optional[Receipt]:
    receipt = get_receipt_by_id(db, receipt_id, user_id)
    if receipt:
        key = receipt.image_key
        db.delete(receipt)
        db.commit()
        if key:
            storage_service.delete(key)
    return receipt


def delete_all_receipts(db: Session, user_id: int) -> int:
    q = db.query(Receipt).filter(Receipt.user_id == user_id)
    keys = [k for (k,) in q.with_entities(Receipt.image_key) if k]
    deleted = q.delete(synchronize_session=False)
    db.commit()
    for key in keys:
        storage_service.delete(key)
    return deleted


# ═════════════════════════════════════════════════════════════════════════════
#  AGGREGATES (used by the chat tools; numbers are computed here, never by the LLM)
# ═════════════════════════════════════════════════════════════════════════════

def spending_summary(
    db: Session,
    user_id: int,
    *,
    start: Optional[date] = None,
    end: Optional[date] = None,
    group_by: Optional[str] = None,  # "merchant" | "month" | "category" | None
    merchant: Optional[str] = None,
    category: Optional[str] = None,
    currency: Optional[str] = None,
) -> List[dict]:
    """Totals and counts, always split by currency (amounts in different currencies never mix)."""
    group_cols = {
        "merchant": Receipt.merchant_name,
        "month": func.to_char(Receipt.receipt_date, "YYYY-MM"),
        "category": Receipt.category,
    }
    group_col = group_cols.get(group_by or "")
    cols = [Receipt.currency]
    if group_col is not None:
        cols.insert(0, group_col.label("group"))

    q = db.query(
        *cols,
        func.sum(Receipt.total_amount).label("total"),
        func.count(Receipt.receipt_id).label("receipts"),
    ).filter(Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES))
    q = _filter_receipts(q, start=start, end=end, merchant=merchant, category=category)
    if currency:
        q = q.filter(Receipt.currency == currency)
    q = q.group_by(*cols).order_by(func.sum(Receipt.total_amount).desc())
    return [
        {
            **row._asdict(),
            "total": round(float(row.total or 0), 2),
            "average": round(float(row.total or 0) / row.receipts, 2) if row.receipts else 0.0,
        }
        for row in q.limit(100).all()
    ]


def list_items(
    db: Session,
    user_id: int,
    *,
    query: Optional[str] = None,
    merchant: Optional[str] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    limit: int = 50,
) -> List[dict]:
    q = (
        db.query(
            ReceiptItem.item_name,
            ReceiptItem.quantity,
            ReceiptItem.unit_price,
            ReceiptItem.line_total,
            Receipt.merchant_name,
            Receipt.receipt_date,
            Receipt.currency,
            Receipt.receipt_id,
        )
        .join(Receipt, ReceiptItem.receipt_id == Receipt.receipt_id)
        .filter(Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES))
    )
    if query:
        q = q.filter(ReceiptItem.item_name.ilike(f"%{query.strip()}%"))
    q = _filter_receipts(q, start=start, end=end, merchant=merchant)
    rows = q.order_by(Receipt.receipt_date.desc()).limit(limit).all()
    return [row._asdict() for row in rows]


def dashboard(db: Session, user_id: int, currency: Optional[str] = None) -> dict:
    """Dashboard numbers for one currency (default: the one with most receipts)."""
    per_currency = [r for r in spending_summary(db, user_id) if r["currency"]]
    if currency not in {r["currency"] for r in per_currency}:
        currency = max(per_currency, key=lambda r: r["receipts"])["currency"] if per_currency else None
    selected = next((r for r in per_currency if r["currency"] == currency), None)

    def grouped(group_by: str, **kw) -> List[dict]:
        if not currency:
            return []
        return [
            {"label": r["group"] or "Unknown", "total": r["total"]}
            for r in spending_summary(db, user_id, group_by=group_by, currency=currency, **kw)
        ]

    today = date.today()
    this_month = spending_summary(db, user_id, start=today.replace(day=1), currency=currency)
    by_month = grouped("month", start=(today.replace(day=1) - timedelta(days=335)).replace(day=1))
    needs_review = (
        db.query(func.count(Receipt.receipt_id))
        .filter(Receipt.user_id == user_id, Receipt.status == STATUS_NEEDS_REVIEW)
        .scalar()
    )
    return {
        "currencies": [
            {"currency": r["currency"], "total": r["total"], "receipts": r["receipts"]}
            for r in per_currency
        ],
        "currency": currency,
        "total": selected["total"] if selected else 0.0,
        "receipts": selected["receipts"] if selected else 0,
        "average": selected["average"] if selected else 0.0,
        "this_month": this_month[0]["total"] if this_month and currency else 0.0,
        "by_month": sorted(by_month, key=lambda r: r["label"]),
        "by_merchant": grouped("merchant")[:5],
        "by_category": grouped("category"),
        "needs_review": int(needs_review or 0),
    }


def main_currency(db: Session, user_id: int) -> Optional[str]:
    """The currency most of the user's receipts are in."""
    row = (
        db.query(Receipt.currency)
        .filter(Receipt.user_id == user_id, Receipt.currency.isnot(None))
        .group_by(Receipt.currency)
        .order_by(func.count().desc())
        .first()
    )
    return row[0] if row else None
