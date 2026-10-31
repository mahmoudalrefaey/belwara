"""Business logic for user operations."""

from typing import Optional

from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.chat import ChatMessage
from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.user import UserCreate
from app.services import storage_service


def create_user(db: Session, payload: UserCreate) -> User:
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        phone_number=payload.phone_number,
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def delete_user(db: Session, user: User) -> None:
    """Delete the account and everything it owns, including stored receipt files."""
    keys = [
        k for (k,) in db.query(Receipt.image_key).filter(Receipt.user_id == user.user_id) if k
    ]
    db.delete(user)  # receipts/items via ORM cascade; chat + usage via ON DELETE CASCADE
    db.commit()
    for key in keys:
        storage_service.delete(key)


def export_user(db: Session, user: User) -> dict:
    """Everything stored about the user, as plain JSON-serialisable data."""
    receipts = (
        db.query(Receipt)
        .options(selectinload(Receipt.items))
        .filter(Receipt.user_id == user.user_id)
        .order_by(Receipt.receipt_id)
        .all()
    )
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user.user_id, ChatMessage.deleted_at.is_(None))
        .order_by(ChatMessage.id)
        .all()
    )
    return {
        "profile": {
            "email": user.email,
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "plan": user.plan,
            "created_at": user.created_at,
        },
        "receipts": [
            {
                "receipt_id": r.receipt_id,
                "status": r.status,
                "merchant_name": r.merchant_name,
                "receipt_date": r.receipt_date,
                "total_amount": r.total_amount,
                "total_taxes": r.total_taxes,
                "other": r.other,
                "currency": r.currency,
                "category": r.category,
                "raw_text": r.raw_text,
                "source_filename": r.source_filename,
                "created_at": r.created_at,
                "items": [
                    {
                        "item_name": i.item_name,
                        "quantity": i.quantity,
                        "unit_price": i.unit_price,
                        "line_total": i.line_total,
                        "taxes": i.taxes,
                    }
                    for i in r.items
                ],
            }
            for r in receipts
        ],
        "chat_messages": [
            {"thread_id": m.thread_id, "role": m.role, "content": m.content, "created_at": m.created_at,
             **({"attachments": m.attachments} if m.attachments else {}),
             **({"actions": [{"kind": a.kind, "receipt_id": a.receipt_id, "payload": a.payload,
                              "status": a.current_status, "created_at": a.created_at,
                              "resolved_at": a.resolved_at} for a in m.actions]} if m.actions else {})}
            for m in messages
        ],
    }
