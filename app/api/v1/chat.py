"""Chat endpoints — one assistant turn, plus thread history for web and mobile."""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from openai import APIError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user_id, get_db
from app.core.rate_limit import limit_chat
from app.schemas.chat import ChatActionOut, ChatMessageOut, ChatRequest, ChatResponse, ChatThreadSummary
from app.services import action_service, chat_service, quota_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
@limit_chat
def chat(
    request: Request,
    body: ChatRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    quota_service.check(db, user_id, "chat")
    try:
        turn, thread_id = chat_service.chat_turn(db, user_id, body.message, body.thread_id)
    except APIError:
        log.exception("Chat model call failed")
        raise HTTPException(
            status_code=503, detail="The assistant is temporarily unavailable. Please try again."
        )
    return ChatResponse(
        reply=turn.reply, thread_id=thread_id, receipts=turn.receipts,
        actions=[ChatActionOut.model_validate(a) for a in turn.actions],
    )


_ACTION_ERRORS = {"not_found": 404, "expired": 410}


def _resolve(fn, db: Session, user_id: int, action_id: str) -> ChatActionOut:
    try:
        return ChatActionOut.model_validate(fn(db, user_id, action_id))
    except action_service.ActionError as e:
        raise HTTPException(status_code=_ACTION_ERRORS.get(e.status, 409),
                            detail={"status": e.status, "message": str(e)})


@router.post("/actions/{action_id}/confirm", response_model=ChatActionOut)
@limit_chat
def confirm_action(
    request: Request,
    action_id: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Carry out a change Wara'a prepared. Runs once; repeating it returns the same result."""
    return _resolve(action_service.confirm, db, user_id, action_id)


@router.post("/actions/{action_id}/cancel", response_model=ChatActionOut)
@limit_chat
def cancel_action(
    request: Request,
    action_id: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return _resolve(action_service.cancel, db, user_id, action_id)


@router.get("/threads", response_model=List[ChatThreadSummary])
def list_threads(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return chat_service.list_threads(db, user_id)


@router.get("/threads/{thread_id}", response_model=List[ChatMessageOut])
def get_thread(
    thread_id: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    messages = chat_service.get_thread(db, user_id, thread_id)
    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return messages


@router.delete("/threads/{thread_id}", status_code=204)
def delete_thread(
    thread_id: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete one of the user's conversations (it disappears from history, export and the model)."""
    if not chat_service.delete_thread(db, user_id, thread_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return Response(status_code=204)
