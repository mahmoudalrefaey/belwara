"""Request/response models for the chat endpoints."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    thread_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Omit to start a new conversation; send the returned id to continue.",
    )


class ChatResponse(BaseModel):
    reply: str
    thread_id: str


class ChatThreadSummary(BaseModel):
    thread_id: str
    title: str
    last_message_at: datetime


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
