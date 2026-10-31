"""SQLAlchemy ORM model for changes proposed in the chat and confirmed (or not) by the user."""

from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, Column, DateTime, ForeignKey, Index, String, func

from app.core.database import Base

ACTION_PENDING = "pending"
ACTION_DONE = "done"
ACTION_CANCELLED = "cancelled"
ACTION_EXPIRED = "expired"
ACTION_STALE = "stale"    # the receipt changed (or was deleted) after the change was proposed
ACTION_FAILED = "failed"


class ChatAction(Base):
    __tablename__ = "chat_actions"

    action_id = Column(String(36), primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    thread_id = Column(String(64), nullable=True)
    message_id = Column(BigInteger, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True)
    kind = Column(String(20), nullable=False)          # set_category | mark_reviewed | delete_receipt
    receipt_id = Column(BigInteger, nullable=False)    # no FK: a deleted receipt keeps its record
    payload = Column(JSON)                             # {"category": ...} for set_category
    summary = Column(JSON)                             # what the card shows about the receipt
    target_updated_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(12), nullable=False, default=ACTION_PENDING, server_default=ACTION_PENDING)
    result = Column(JSON)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    resolved_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_chat_actions_user_receipt", "user_id", "receipt_id"),
        Index("ix_chat_actions_message", "message_id"),
    )

    @property
    def current_status(self) -> str:
        """Status as the user should see it: a pending change past its expiry is expired."""
        if self.status == ACTION_PENDING and self.expires_at <= datetime.now(timezone.utc):
            return ACTION_EXPIRED
        return self.status
