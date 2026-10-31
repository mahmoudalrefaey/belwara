"""Request/response models for the chat endpoints."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    thread_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Omit to start a new conversation; send the returned id to continue.",
    )


class ChatReceiptCard(BaseModel):
    """A receipt attached to a reply; the app opens it at /receipts?open=<receipt_id>."""

    receipt_id: int
    merchant: Optional[str] = None
    date: Optional[str] = None
    total: Optional[str] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    status: str
    verification: Optional[str] = None


class ChatActionOut(BaseModel):
    """A change Wara'a prepared; only POST /chat/actions/{action_id}/confirm carries it out."""

    model_config = ConfigDict(from_attributes=True)

    action_id: str
    kind: Literal["set_category", "mark_reviewed", "delete_receipt"]
    receipt_id: int
    # pending | done | cancelled | expired | stale | failed
    status: str = Field(validation_alias="current_status")
    payload: Optional[dict] = None
    summary: Optional[dict] = None
    result: Optional[dict] = None
    expires_at: datetime


class ChatResponse(BaseModel):
    reply: str
    thread_id: str
    receipts: List[ChatReceiptCard] = []
    actions: List[ChatActionOut] = []


class ChatThreadSummary(BaseModel):
    thread_id: str
    title: str
    last_message_at: datetime


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    receipts: List[ChatReceiptCard] = []
    actions: List[ChatActionOut] = []
