"""Business logic for receipt CRUD, search, and spending aggregates (all scoped to one user)."""

from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import case, func, or_, select
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
    merchants: Optional[Sequence[str]] = None,
    category: Optional[str] = None,
    currency: Optional[str] = None,
    status: Optional[str] = None,
    statuses: Optional[Sequence[str]] = None,
) -> Query:
    """Shared filters; `end` is inclusive. `merchants` matches stored names exactly (already resolved)."""
    if start:
        q = q.filter(Receipt.receipt_date >= _day_start(start))
    if end:
        q = q.filter(Receipt.receipt_date < _day_start(end + timedelta(days=1)))
    if merchant:
        q = q.filter(Receipt.merchant_name.ilike(f"%{merchant.strip()}%"))
    if merchants is not None:
        q = q.filter(Receipt.merchant_name.in_(list(merchants)))
    if category:
        q = q.filter(Receipt.category == category)
    if currency:
        q = q.filter(Receipt.currency == currency.strip().upper())
    if status:
        q = q.filter(Receipt.status == status)
    if statuses is not None:
        q = q.filter(Receipt.status.in_(list(statuses)))
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
        confirmed_at=datetime.now(timezone.utc),  # typed in by the user, so verified
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
    mark_confirmed(receipt)
    db.commit()
    return get_receipt_by_id(db, receipt.receipt_id, receipt.user_id)


def mark_confirmed(receipt: Receipt) -> None:
    """The user vouched for the values: ready, no review reasons, verified now (caller commits)."""
    receipt.status = STATUS_READY
    receipt.review_reasons = None
    receipt.confirmed_at = datetime.now(timezone.utc)


# Orderings the chat can ask for; the REST list keeps "recently_uploaded".
RECEIPT_SORTS = {
    "newest": (Receipt.receipt_date.desc().nulls_last(), Receipt.created_at.desc()),
    "oldest": (Receipt.receipt_date.asc().nulls_last(), Receipt.created_at.asc()),
    "largest": (Receipt.total_amount.desc().nulls_last(), Receipt.receipt_date.desc()),
    "smallest": (Receipt.total_amount.asc().nulls_last(), Receipt.receipt_date.desc()),
    "recently_uploaded": (Receipt.created_at.desc(),),
}


def list_receipts_page(
    db: Session,
    user_id: int,
    *,
    limit: int,
    offset: int,
    start: Optional[date] = None,
    end: Optional[date] = None,
    merchant: Optional[str] = None,
    merchants: Optional[Sequence[str]] = None,
    category: Optional[str] = None,
    currency: Optional[str] = None,
    status: Optional[str] = None,
    statuses: Optional[Sequence[str]] = None,
    text: Optional[str] = None,
    sort: str = "recently_uploaded",
) -> Tuple[List[Receipt], int]:
    """Paginated receipts for one user; no items loaded. `text` searches merchant, items and receipt text."""
    base = _filter_receipts(
        db.query(Receipt).filter(Receipt.user_id == user_id),
        start=start, end=end, merchant=merchant, merchants=merchants, category=category,
        currency=currency, status=status, statuses=statuses,
    )
    if text:
        matching = (
            select(Receipt.receipt_id)
            .outerjoin(Receipt.items)
            .where(Receipt.user_id == user_id, _search_conditions(text.strip(), include_raw=True))
        )
        base = base.filter(Receipt.receipt_id.in_(matching))
    total = base.count()
    rows = base.order_by(*RECEIPT_SORTS[sort]).offset(offset).limit(limit).all()
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

CENT = Decimal("0.01")


def money(value) -> Optional[Decimal]:
    """Round to cents (half up), keeping Decimal; None stays None."""
    if value is None:
        return None
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def _utc(col):
    """The stored UTC timestamp, independent of the database session's time zone."""
    return func.timezone("UTC", col)


def spending_summary(
    db: Session,
    user_id: int,
    *,
    start: Optional[date] = None,
    end: Optional[date] = None,
    group_by: Optional[str] = None,  # "merchant" | "month" | "day" | "category" | None
    merchant: Optional[str] = None,
    merchants: Optional[Sequence[str]] = None,
    category: Optional[str] = None,
    currency: Optional[str] = None,
) -> List[dict]:
    """
    Totals per currency (amounts in different currencies never mix), optionally grouped.

    Receipts without a total are not summed; they are counted in `missing_total` so callers can
    say the figure is incomplete. Each row also reports how much of it rests on receipts flagged
    for review and how many receipts a person confirmed.
    """
    group_cols = {
        "merchant": Receipt.merchant_name,
        "month": func.to_char(_utc(Receipt.receipt_date), "YYYY-MM"),
        "day": func.to_char(_utc(Receipt.receipt_date), "YYYY-MM-DD"),
        "category": Receipt.category,
    }
    group_col = group_cols.get(group_by or "")
    cols = [Receipt.currency]
    if group_col is not None:
        cols.insert(0, group_col.label("group"))

    has_total = Receipt.total_amount.isnot(None)
    flagged = Receipt.status == STATUS_NEEDS_REVIEW
    q = db.query(
        *cols,
        func.sum(Receipt.total_amount).label("total"),
        func.count(Receipt.total_amount).label("receipts"),
        func.count(Receipt.receipt_id).label("all_receipts"),
        func.sum(case((has_total, Receipt.total_taxes), else_=0)).label("tax"),
        func.sum(case((has_total, Receipt.other), else_=0)).label("other_charges"),
        func.sum(case((flagged, 1), else_=0)).label("needs_review"),
        func.sum(case((flagged & has_total, Receipt.total_amount), else_=0)).label("needs_review_amount"),
        func.count(Receipt.confirmed_at).label("verified"),
    ).filter(Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES))
    q = _filter_receipts(q, start=start, end=end, merchant=merchant, merchants=merchants,
                         category=category, currency=currency)
    q = q.group_by(*cols).order_by(func.sum(Receipt.total_amount).desc().nulls_last())
    rows = []
    for row in q.limit(100).all():
        total = money(row.total or 0)
        rows.append({
            **({"group": row.group} if group_col is not None else {}),
            "currency": row.currency,
            "total": total,
            "receipts": row.receipts,
            "missing_total": row.all_receipts - row.receipts,
            "average": money(total / row.receipts) if row.receipts else None,
            "tax": money(row.tax or 0),
            "other_charges": money(row.other_charges or 0),
            "needs_review": int(row.needs_review or 0),
            "needs_review_amount": money(row.needs_review_amount or 0),
            "verified": row.verified,
        })
    return rows


def daily_buckets(
    db: Session,
    user_id: int,
    *,
    group_by: Optional[str] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    merchants: Optional[Sequence[str]] = None,
    category: Optional[str] = None,
    currency: Optional[str] = None,
) -> List[Tuple[Optional[str], Optional[date], str, Decimal, Decimal]]:
    """(group, day, currency, total, tax) per receipt day, so each day converts at its own rate."""
    day = func.date(_utc(Receipt.receipt_date))
    group = {
        "merchant": Receipt.merchant_name,
        "category": Receipt.category,
        "month": func.to_char(_utc(Receipt.receipt_date), "YYYY-MM"),
    }.get(group_by or "")
    cols = [day, Receipt.currency] + ([group] if group is not None else [])
    q = db.query(*cols, func.sum(Receipt.total_amount), func.sum(Receipt.total_taxes)).filter(
        Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES), Receipt.total_amount.isnot(None)
    )
    q = _filter_receipts(q, start=start, end=end, merchants=merchants, category=category, currency=currency)
    out = []
    for row in q.group_by(*cols).all():
        d, cur, *rest = row
        g = rest[0] if group is not None else None
        out.append((g, d, cur, Decimal(rest[-2]), Decimal(rest[-1] or 0)))
    return out


def merchant_names(
    db: Session, user_id: int, *, start: Optional[date] = None, end: Optional[date] = None,
    category: Optional[str] = None,
) -> List[Tuple[str, int, int]]:
    """(stored merchant name, counted receipts, receipts inside the given period/category)."""
    scoped = _filter_receipts(db.query(Receipt.receipt_id), start=start, end=end, category=category)
    in_scope = Receipt.receipt_id.in_(scoped.filter(Receipt.user_id == user_id).scalar_subquery())
    rows = (
        db.query(Receipt.merchant_name, func.count(), func.sum(case((in_scope, 1), else_=0)))
        .filter(Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES),
                Receipt.merchant_name.isnot(None))
        .group_by(Receipt.merchant_name)
        .all()
    )
    return [(n, c, int(k or 0)) for n, c, k in rows]


def item_names(
    db: Session, user_id: int, *, merchants: Optional[Sequence[str]] = None,
    category: Optional[str] = None, start: Optional[date] = None, end: Optional[date] = None,
) -> List[Tuple[str, int]]:
    """(stored item name, times bought) among counted receipts in scope."""
    q = (
        db.query(ReceiptItem.item_name, func.count())
        .join(Receipt, ReceiptItem.receipt_id == Receipt.receipt_id)
        .filter(Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES))
    )
    q = _filter_receipts(q, start=start, end=end, merchants=merchants, category=category)
    return q.group_by(ReceiptItem.item_name).all()


ITEM_SORTS = {
    "newest": (Receipt.receipt_date.desc().nulls_last(),),
    "highest_price": (ReceiptItem.unit_price.desc(), Receipt.receipt_date.desc()),
    "highest_total": (ReceiptItem.line_total.desc(), Receipt.receipt_date.desc()),
}


def _item_query(db: Session, user_id: int, *, query, names, merchants, start, end, currency, category=None):
    q = db.query(ReceiptItem).join(Receipt, ReceiptItem.receipt_id == Receipt.receipt_id).filter(
        Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES)
    )
    if query:
        q = q.filter(ReceiptItem.item_name.ilike(f"%{query.strip()}%"))
    if names is not None:
        q = q.filter(ReceiptItem.item_name.in_(list(names)))
    return _filter_receipts(q, start=start, end=end, merchants=merchants, currency=currency,
                            category=category)


def list_items(
    db: Session,
    user_id: int,
    *,
    query: Optional[str] = None,
    names: Optional[Sequence[str]] = None,
    merchant: Optional[str] = None,
    merchants: Optional[Sequence[str]] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    currency: Optional[str] = None,
    category: Optional[str] = None,
    sort: str = "newest",
    limit: int = 50,
) -> List[dict]:
    """Purchased line items with their receipt's merchant, date, currency and review state."""
    q = _item_query(db, user_id, query=query, names=names, merchants=merchants, start=start, end=end,
                    currency=currency, category=category)
    if merchant:
        q = q.filter(Receipt.merchant_name.ilike(f"%{merchant.strip()}%"))
    rows = q.with_entities(
        ReceiptItem.item_name, ReceiptItem.quantity, ReceiptItem.unit_price, ReceiptItem.line_total,
        Receipt.merchant_name, Receipt.receipt_date, Receipt.currency, Receipt.receipt_id,
        Receipt.status, Receipt.confirmed_at,
    ).order_by(*ITEM_SORTS[sort]).limit(limit).all()
    return [row._asdict() for row in rows]


def item_summary(
    db: Session,
    user_id: int,
    *,
    query: Optional[str] = None,
    names: Optional[Sequence[str]] = None,
    merchants: Optional[Sequence[str]] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    currency: Optional[str] = None,
    category: Optional[str] = None,
) -> List[dict]:
    """Per item name and currency: times bought, total quantity, total spent (sum of line totals)."""
    q = _item_query(db, user_id, query=query, names=names, merchants=merchants, start=start, end=end,
                    currency=currency, category=category).with_entities(
        ReceiptItem.item_name,
        Receipt.currency,
        func.count(ReceiptItem.item_id).label("times"),
        func.sum(ReceiptItem.quantity).label("quantity"),
        func.sum(ReceiptItem.line_total).label("spent"),
        func.min(ReceiptItem.unit_price).label("lowest_unit_price"),
        func.max(ReceiptItem.unit_price).label("highest_unit_price"),
        func.max(Receipt.receipt_date).label("last_bought"),
    ).group_by(ReceiptItem.item_name, Receipt.currency).order_by(func.sum(ReceiptItem.line_total).desc())
    return [
        {
            "item": r.item_name,
            "currency": r.currency,
            "times": r.times,
            "quantity": Decimal(r.quantity),
            "spent": money(r.spent),
            "lowest_unit_price": money(r.lowest_unit_price),
            "highest_unit_price": money(r.highest_unit_price),
            "last_bought": r.last_bought,
        }
        for r in q.limit(50).all()
    ]


def account_overview(db: Session, user_id: int) -> dict:
    """What the user has: receipts by status, date span, currencies, and what needs attention."""
    by_status = dict(
        db.query(Receipt.status, func.count())
        .filter(Receipt.user_id == user_id)
        .group_by(Receipt.status)
        .all()
    )
    counted = db.query(Receipt).filter(Receipt.user_id == user_id, Receipt.status.in_(COUNTED_STATUSES))
    first, latest = counted.with_entities(
        func.min(Receipt.receipt_date), func.max(Receipt.receipt_date)
    ).one()
    last_upload = db.query(func.max(Receipt.created_at)).filter(Receipt.user_id == user_id).scalar()
    currencies = (
        counted.with_entities(Receipt.currency, func.count())
        .group_by(Receipt.currency)
        .order_by(func.count().desc())
        .all()
    )
    flagged = (
        db.query(Receipt)
        .filter(Receipt.user_id == user_id, Receipt.status == STATUS_NEEDS_REVIEW)
        .order_by(Receipt.receipt_date.desc().nulls_last())
        .limit(10)
        .all()
    )
    return {
        "receipts_by_status": by_status,
        "first_receipt_date": first,
        "latest_receipt_date": latest,
        "last_upload_at": last_upload,
        "currencies": [{"currency": c, "receipts": n} for c, n in currencies],
        "needs_review": flagged,
    }


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
            {"label": r["group"] or "Unknown", "total": float(r["total"])}
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
            {"currency": r["currency"], "total": float(r["total"]), "receipts": r["receipts"]}
            for r in per_currency
        ],
        "currency": currency,
        "total": float(selected["total"]) if selected else 0.0,
        "receipts": selected["receipts"] if selected else 0,
        "average": float(selected["average"] or 0) if selected else 0.0,
        "this_month": float(this_month[0]["total"]) if this_month and currency else 0.0,
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
