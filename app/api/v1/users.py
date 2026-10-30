"""User endpoints — register, login, and user lookup."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user_id, get_db
from app.core.rate_limit import limit_login, limit_register
from app.core.security import create_access_token, verify_password
from app.schemas.user import (
    DeleteAccountBody,
    TokenResponse,
    UsageResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services import quota_service, user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserResponse, status_code=201)
@limit_register
def register_user(
    request: Request,
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    """Register a new user. Returns user profile (no password)."""
    if user_service.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    return user_service.create_user(db, payload)


@router.post("/login", response_model=TokenResponse)
@limit_login
def login_user(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with email + password and receive a JWT access token."""
    user = user_service.get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    token = create_access_token(user.user_id)
    return TokenResponse(access_token=token, user_id=user.user_id)


@router.get("/me/usage", response_model=UsageResponse)
def get_my_usage(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """This month's usage against the user's plan limits (limit 0 = unlimited)."""
    return quota_service.usage(db, current_user_id)


@router.get("/me/export")
def export_my_data(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Download everything stored about the account as JSON."""
    user = user_service.get_user_by_id(db, current_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return JSONResponse(
        content=jsonable_encoder(user_service.export_user(db, user)),
        headers={"Content-Disposition": 'attachment; filename="belwara-export.json"'},
    )


@router.delete("/me")
def delete_my_account(
    body: DeleteAccountBody,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Permanently delete the account, receipts, files and chat history (password required)."""
    user = user_service.get_user_by_id(db, current_user_id)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Password is incorrect")
    user_service.delete_user(db, user)
    return {"message": "Account deleted"}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Fetch the authenticated user's own profile only (prevents IDOR enumeration)."""
    if user_id != current_user_id:
        raise HTTPException(status_code=404, detail="User not found")
    user = user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
