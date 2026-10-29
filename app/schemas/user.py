"""Pydantic request/response schemas for users."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    phone_number: Optional[str] = Field(None, max_length=30)
    full_name: Optional[str] = Field(None, max_length=255)


class UserLogin(BaseModel):
    email: str = Field(..., max_length=255)
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    email: str
    phone_number: Optional[str]
    full_name: Optional[str]
    is_active: bool
    plan: str
    created_at: datetime


class DeleteAccountBody(BaseModel):
    password: str


class QuotaUsage(BaseModel):
    used: int
    limit: int  # 0 = unlimited


class UsageResponse(BaseModel):
    plan: str
    receipts: QuotaUsage
    chat: QuotaUsage


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
