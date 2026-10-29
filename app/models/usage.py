"""SQLAlchemy ORM model for per-call LLM token usage (cost tracking and quotas)."""

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, Integer, String, func

from app.core.database import Base


class LlmUsage(Base):
    __tablename__ = "llm_usage"

    id = Column(BigInteger, primary_key=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    kind = Column(String(20), nullable=False)  # "receipt" | "chat"
    deployment = Column(String(100), nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (Index("ix_llm_usage_user_created", "user_id", "created_at"),)
