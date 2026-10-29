"""Monthly plan quotas: receipts uploaded and chat messages sent."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import PLAN_LIMITS
from app.models.chat import ChatMessage
from app.models.receipt import Receipt
from app.models.user import User


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def usage(db: Session, user_id: int) -> dict:
    """{plan, receipts: {used, limit}, chat: {used, limit}}; limit 0 means unlimited."""
    plan = db.query(User.plan).filter(User.user_id == user_id).scalar() or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    since = _month_start()
    receipts = (
        db.query(func.count(Receipt.receipt_id))
        .filter(
            Receipt.user_id == user_id,
            Receipt.image_key.isnot(None),
            Receipt.created_at >= since,
        )
        .scalar()
    )
    chat = (
        db.query(func.count(ChatMessage.id))
        .filter(
            ChatMessage.user_id == user_id,
            ChatMessage.role == "user",
            ChatMessage.created_at >= since,
        )
        .scalar()
    )
    return {
        "plan": plan,
        "receipts": {"used": int(receipts or 0), "limit": limits["receipts"]},
        "chat": {"used": int(chat or 0), "limit": limits["chat"]},
    }


def check(db: Session, user_id: int, kind: str, incoming: int = 1) -> None:
    """Raise 402 when `incoming` more receipts/messages would exceed this month's limit."""
    current = usage(db, user_id)
    used, limit = current[kind]["used"], current[kind]["limit"]
    if limit and used + incoming > limit:
        noun = "receipt uploads" if kind == "receipts" else "chat messages"
        raise HTTPException(
            status_code=402,
            detail={
                "message": f"You've reached this month's {noun} limit on the {current['plan']} plan.",
                "plan": current["plan"],
                "used": used,
                "limit": limit,
            },
        )
