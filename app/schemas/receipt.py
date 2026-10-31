"""Pydantic request/response schemas for receipts."""

from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.currencies import normalize_currency

ReceiptStatus = Literal["processing", "ready", "needs_review", "failed"]


class DeleteAllReceiptsBody(BaseModel):
    """Required body for destructive bulk delete."""

    confirm: Literal["DELETE_ALL_RECEIPTS"]


class ReceiptItemBase(BaseModel):
    item_name: str = Field(..., max_length=150)
    quantity: Decimal = Field(..., gt=0, max_digits=10, decimal_places=3)  # a count or a weight
    unit_price: Decimal = Field(..., ge=0)
    line_total: Decimal = Field(..., ge=0)
    taxes: Decimal = Field(0, ge=0)


class ReceiptItemCreate(ReceiptItemBase):
    pass


class ReceiptItemResponse(ReceiptItemBase):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    receipt_id: int


class ReceiptCreate(BaseModel):
    """Manual entry: every core field is required."""

    merchant_name: str = Field(..., max_length=150)
    receipt_date: datetime
    total_amount: Decimal = Field(..., ge=0)
    total_taxes: Decimal = Field(0, ge=0)
    other: Decimal = Field(0, ge=0)
    currency: str = Field(..., max_length=10)
    category: Optional[str] = Field(None, max_length=30)
    raw_text: Optional[str] = None
    items: List[ReceiptItemCreate]

    @field_validator("currency")
    @classmethod
    def _iso_currency(cls, v: str) -> str:
        return normalize_currency(v)


class ReceiptUpdate(BaseModel):
    """User correction (PATCH). Omitted fields are unchanged; `items` replaces all items."""

    merchant_name: Optional[str] = Field(None, min_length=1, max_length=150)
    receipt_date: Optional[datetime] = None
    total_amount: Optional[Decimal] = Field(None, ge=0)
    total_taxes: Optional[Decimal] = Field(None, ge=0)
    other: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=10)
    category: Optional[str] = Field(None, max_length=30)
    items: Optional[List[ReceiptItemCreate]] = None

    @field_validator("currency")
    @classmethod
    def _iso_currency(cls, v: Optional[str]) -> Optional[str]:
        return normalize_currency(v) if v is not None else v


class ReceiptSummary(BaseModel):
    """List/search row without line items (avoids N+1 and large payloads)."""

    model_config = ConfigDict(from_attributes=True)

    receipt_id: int
    user_id: int
    status: ReceiptStatus
    review_reasons: Optional[List[str]] = None
    merchant_name: Optional[str]
    receipt_date: Optional[datetime]
    total_amount: Optional[Decimal]
    total_taxes: Decimal
    other: Decimal
    currency: Optional[str]
    category: Optional[str]
    source_filename: Optional[str]
    has_image: bool
    created_at: datetime


class ReceiptResponse(ReceiptSummary):
    raw_text: Optional[str] = None
    items: List[ReceiptItemResponse]


class UploadResponse(BaseModel):
    message: str
    receipts: List[ReceiptSummary]


class CurrencyTotal(BaseModel):
    currency: str
    total: float
    receipts: int


class LabeledTotal(BaseModel):
    label: str
    total: float


class DashboardResponse(BaseModel):
    """All amounts are in `currency`; other currencies are listed in `currencies`."""

    currencies: List[CurrencyTotal]
    currency: Optional[str]
    total: float
    receipts: int
    average: float
    this_month: float
    by_month: List[LabeledTotal]
    by_merchant: List[LabeledTotal]
    by_category: List[LabeledTotal]
    needs_review: int


class PaginatedReceiptsResponse(BaseModel):
    items: List[ReceiptSummary]
    total: int
    limit: int
    offset: int


class ReceiptSearchResponse(BaseModel):
    """Capped search; total is count of distinct matching receipts."""

    items: List[ReceiptSummary]
    total: int
    limit: int
    offset: int
    include_raw_text_in_search: bool
