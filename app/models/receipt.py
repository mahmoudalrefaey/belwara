"""SQLAlchemy ORM models for receipts and their line items."""

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base

# Receipt lifecycle. Only READY and NEEDS_REVIEW receipts count in analytics.
STATUS_PROCESSING = "processing"
STATUS_READY = "ready"
STATUS_NEEDS_REVIEW = "needs_review"
STATUS_FAILED = "failed"
COUNTED_STATUSES = (STATUS_READY, STATUS_NEEDS_REVIEW)


class Receipt(Base):
    __tablename__ = "receipt"

    receipt_id = Column(BigInteger, primary_key=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default=STATUS_READY, index=True)
    review_reasons = Column(JSON)  # list of reason codes when status is needs_review/failed
    # Extracted fields are nullable: unknown while processing or when extraction fails.
    merchant_name = Column(String(150))
    receipt_date = Column(DateTime(timezone=True))
    total_amount = Column(Numeric(10, 2))
    total_taxes = Column(Numeric(10, 2), nullable=False, default=0)
    other = Column(Numeric(10, 2), nullable=False, default=0)
    currency = Column(String(10))
    category = Column(String(30))
    raw_text = Column(Text)
    image_key = Column(String(255))  # storage key of the original upload
    # Set when the user corrects or confirms the receipt: its values are then verified, not just extracted.
    confirmed_at = Column(DateTime(timezone=True))
    source_filename = Column(String(255))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="receipts")
    items = relationship(
        "ReceiptItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_receipt_user_date", "user_id", "receipt_date"),)

    @property
    def has_image(self) -> bool:
        return self.image_key is not None

    @property
    def verification(self) -> str:
        """verified (a person confirmed it) | needs_review (flagged) | extracted (accepted automatically)."""
        if self.status == STATUS_NEEDS_REVIEW:
            return "needs_review"
        return "verified" if self.confirmed_at is not None else "extracted"


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    item_id = Column(BigInteger, primary_key=True)
    receipt_id = Column(
        BigInteger,
        ForeignKey("receipt.receipt_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_name = Column(String(150), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)  # a count, or a weight such as 1.5 (kg)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_total = Column(Numeric(10, 2), nullable=False)
    taxes = Column(Numeric(10, 2), nullable=False, default=0)

    receipt = relationship("Receipt", back_populates="items")
