"""SQLAlchemy ORM model for persisted chat history."""

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, String, Text, func

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

    __table_args__ = (Index("ix_chat_messages_user_thread", "user_id", "thread_id", "id"),)
