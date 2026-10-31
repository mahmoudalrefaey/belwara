"""
Changes the assistant proposes and only the user's confirmation carries out.

propose()  checks ownership and preconditions now and stores a pending action; nothing else changes.
confirm()  one transaction: lock the action, check it's pending and fresh, lock the receipt, check it
           is unchanged since the proposal, apply, mark done. A second confirm (double tap, retry,
           concurrent request) waits on the lock, then sees "done" and changes nothing.
cancel()   pending → cancelled.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.currencies import ISO_4217
from app.models.chat_action import (
    ACTION_CANCELLED,
    ACTION_DONE,
    ACTION_EXPIRED,
    ACTION_FAILED,
    ACTION_PENDING,
    ACTION_STALE,
    ChatAction,
)
from app.models.receipt import STATUS_NEEDS_REVIEW, STATUS_PROCESSING, Receipt
from app.services import receipt_service, storage_service

KINDS = ("set_category", "mark_reviewed", "delete_receipt")
CATEGORIES = ("groceries", "dining", "transport", "shopping", "bills", "health", "entertainment", "other")
EXPIRY = timedelta(hours=24)


class ActionError(Exception):
    """A confirm/cancel that can't go ahead; `status` says why."""

    def __init__(self, status: str, message: str):
        super().__init__(message)
        self.status = status


@dataclass
class Proposal:
    """What propose() decided: a pending action, or why no change is needed or possible."""

    status: str                        # pending_confirmation | no_change | not_possible | no_results
    action: Optional[ChatAction] = None
    reason: str = ""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def summary(r: Receipt) -> dict:
    return {
        "merchant": r.merchant_name,
        "date": r.receipt_date.astimezone(timezone.utc).date().isoformat() if r.receipt_date else None,
        "total": str(receipt_service.money(r.total_amount)) if r.total_amount is not None else None,
        "currency": r.currency,
        "category": r.category,
        "status": r.status,
    }


def _missing_for_review(r: Receipt) -> List[str]:
    missing = [f for f, v in (("merchant", r.merchant_name), ("date", r.receipt_date),
                              ("total", r.total_amount), ("currency", r.currency)) if v is None]
    if r.currency and r.currency.upper() not in ISO_4217:
        missing.append("a valid currency")
    return missing


def propose(db: Session, user_id: int, *, kind: str, receipt_id: int, category: Optional[str] = None,
            thread_id: Optional[str] = None) -> Proposal:
    if kind not in KINDS:
        return Proposal("not_possible", reason=f"Unknown change {kind}.")
    r = db.query(Receipt).filter(Receipt.receipt_id == receipt_id, Receipt.user_id == user_id).first()
    if r is None:
        return Proposal("no_results", reason="No receipt with that id for this user.")
    if r.status == STATUS_PROCESSING:
        return Proposal("not_possible", reason="The receipt is still being read.")
    payload = None
    if kind == "set_category":
        if category not in CATEGORIES:
            return Proposal("not_possible", reason="Pick one of the app's categories.")
        if r.category == category:
            return Proposal("no_change", reason=f"It is already in {category}.")
        payload = {"category": category}
    elif kind == "mark_reviewed":
        if r.status != STATUS_NEEDS_REVIEW and r.confirmed_at is not None:
            return Proposal("no_change", reason="It is already confirmed.")
        missing = _missing_for_review(r)
        if missing:
            return Proposal("not_possible",
                            reason=f"It can't be confirmed until it has {', '.join(missing)}; "
                                   "the user can add them with Fix details on the receipt.")

    # One pending change of a kind per receipt: a newer proposal replaces the older one.
    for old in db.query(ChatAction).filter(
        ChatAction.user_id == user_id, ChatAction.receipt_id == receipt_id,
        ChatAction.kind == kind, ChatAction.status == ACTION_PENDING,
    ):
        old.status, old.resolved_at = ACTION_CANCELLED, _now()

    action = ChatAction(
        action_id=str(uuid.uuid4()), user_id=user_id, thread_id=thread_id, kind=kind,
        receipt_id=receipt_id, payload=payload, summary=summary(r), target_updated_at=r.updated_at,
        status=ACTION_PENDING, expires_at=_now() + EXPIRY,
    )
    db.add(action)
    db.flush()
    return Proposal("pending_confirmation", action)


def _locked(db: Session, user_id: int, action_id: str) -> ChatAction:
    action = (
        db.query(ChatAction)
        .filter(ChatAction.action_id == action_id, ChatAction.user_id == user_id)
        .with_for_update()
        .first()
    )
    if action is None:  # another user's action looks the same as a missing one
        raise ActionError("not_found", "No such change.")
    return action


def _execute(db: Session, action: ChatAction, r: Receipt) -> dict:
    """Apply the change inside the caller's transaction. Returns the result to record."""
    if action.kind == "set_category":
        r.category = action.payload["category"]
        return {"category": r.category}
    if action.kind == "mark_reviewed":
        missing = _missing_for_review(r)
        if missing:
            raise ActionError(ACTION_STALE, f"The receipt is missing {', '.join(missing)}.")
        receipt_service.mark_confirmed(r)
        return {"status": r.status}
    db.delete(r)
    return {"deleted": True}


def confirm(db: Session, user_id: int, action_id: str) -> ChatAction:
    action = _locked(db, user_id, action_id)
    if action.status == ACTION_DONE:
        db.rollback()
        return action  # already carried out; a repeat changes nothing
    if action.status != ACTION_PENDING:
        status = action.status
        db.rollback()
        raise ActionError(status, f"This change is {status}.")
    if action.expires_at <= _now():
        action.status, action.resolved_at = ACTION_EXPIRED, _now()
        db.commit()
        raise ActionError(ACTION_EXPIRED, "This change expired; ask again in the chat.")

    r = (
        db.query(Receipt)
        .filter(Receipt.receipt_id == action.receipt_id, Receipt.user_id == user_id)
        .with_for_update()
        .first()
    )
    if r is None or r.updated_at != action.target_updated_at:
        action.status, action.resolved_at = ACTION_STALE, _now()
        db.commit()
        raise ActionError(ACTION_STALE, "The receipt changed since this was suggested; ask again.")

    image_key = r.image_key if action.kind == "delete_receipt" else None
    try:
        result = _execute(db, action, r)
        action.status, action.result, action.resolved_at = ACTION_DONE, result, _now()
        db.commit()
    except Exception as e:
        db.rollback()  # nothing from the attempt is kept
        failed = _locked(db, user_id, action_id)
        status = e.status if isinstance(e, ActionError) else ACTION_FAILED
        failed.status, failed.resolved_at = status, _now()
        failed.result = {"error": str(e) if isinstance(e, ActionError)
                         else "The change could not be applied."}
        db.commit()
        if isinstance(e, ActionError):
            raise
        raise ActionError(ACTION_FAILED, "The change could not be applied.") from e
    if image_key:
        storage_service.delete(image_key)
    db.refresh(action)
    return action


def cancel(db: Session, user_id: int, action_id: str) -> ChatAction:
    action = _locked(db, user_id, action_id)
    if action.status == ACTION_CANCELLED:
        db.rollback()
        return action
    if action.status != ACTION_PENDING:
        status = action.status
        db.rollback()
        raise ActionError(status, f"This change is {status}.")
    action.status, action.resolved_at = ACTION_CANCELLED, _now()
    db.commit()
    db.refresh(action)
    return action


def describe(action: ChatAction) -> str:
    """One line for the model's history: what was proposed and what became of it."""
    s = action.summary or {}
    what = {
        "set_category": f"change the category to {(action.payload or {}).get('category')}",
        "mark_reviewed": "mark it as reviewed",
        "delete_receipt": "delete it",
    }[action.kind]
    outcome = {
        ACTION_PENDING: "waiting for the user to confirm on the card",
        ACTION_DONE: "done — the user confirmed it",
        ACTION_CANCELLED: "cancelled — nothing changed",
        ACTION_EXPIRED: "expired unconfirmed — nothing changed",
        ACTION_STALE: "not applied — the receipt had changed",
        ACTION_FAILED: "failed — nothing changed",
    }[action.current_status]
    receipt = (f"receipt #{action.receipt_id} "
               f"({s.get('merchant') or 'unknown merchant'}, {s.get('date') or 'no date'})")
    return f"Proposed to {what} for {receipt}: {outcome}."
