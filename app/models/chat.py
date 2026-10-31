"""SQLAlchemy ORM model for persisted chat history."""

from sqlalchemy import JSON, BigInteger, Column, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    thread_id = Column(String(64), nullable=False)
    role = Column(String(16), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Set when the user deletes the conversation. The text is erased; the row stays only so this
    # month's chat quota still counts the question (user rows) after deletion.
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    attachments = Column(JSON, nullable=True)  # {"receipts": [card, ...]} shown with an assistant reply

    # Changes proposed with this reply, and what became of them. The database sets message_id to
    # NULL when a message is deleted, so the ORM leaves those rows alone.
    actions = relationship("ChatAction", order_by="ChatAction.created_at", lazy="selectin",
                           passive_deletes="all")

    @property
    def receipts(self) -> list:
        return (self.attachments or {}).get("receipts", [])

    __table_args__ = (Index("ix_chat_messages_user_thread", "user_id", "thread_id", "id"),)
