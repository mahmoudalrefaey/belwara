"""One chat turn: history from the DB → model ⇄ tools loop → reply saved to the DB."""

import uuid
from datetime import date
from typing import List, Optional, Tuple

from openai import BadRequestError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import CHAT_DEPLOYMENT, CHAT_HISTORY_MESSAGES, CHAT_MAX_TOOL_STEPS
from app.core.llm import client, record_usage
from app.models.chat import ChatMessage
from app.services import receipt_service
from app.services.chat_tools import TOOL_SPECS, build_tools, run_tool

SYSTEM_PROMPT = """\
You are Wara'a (ورقة), the spending assistant inside Bel War'a (بالورقة). You answer questions about the
user's own receipts.

- Every amount, count and average must come from a tool result. Never add, average or estimate
  numbers yourself; call spending_summary for totals.
- Never add amounts in different currencies together. Report each currency separately, or use
  convert_currency when the user asks for a single currency.
- Today is {today}. Turn relative dates ("last month", "this week", "الشهر الماضي") into exact
  start and end dates.
- {currency_hint}
- If nothing matches, say there are no matching receipts. If results include receipts with status
  needs_review, mention that some receipts still need the user's review.
- Reply in the user's language and tone. Lead with the answer, then brief supporting detail.
  Write money with two decimals and the currency code.
- Never mention tools, databases, queries or how you work internally.
- For requests unrelated to the user's spending, answer briefly and say what you can help with.
"""

_FILTERED_REPLY = "Sorry, I can't help with that request.\nمعلش، مقدرش أساعد في الطلب ده."
_FALLBACK_REPLY = (
    "Sorry, I couldn't work that out. Could you rephrase the question?\n"
    "معلش، معرفتش أوصل للإجابة. ممكن تسأل بطريقة تانية؟"
)


def _system_prompt(db: Session, user_id: int) -> str:
    currency = receipt_service.main_currency(db, user_id)
    hint = (
        f"Most of the user's receipts are in {currency}; prefer it when converting."
        if currency
        else "The user has no receipts yet; suggest uploading some."
    )
    return SYSTEM_PROMPT.format(today=date.today().isoformat(), currency_hint=hint)


def _history(db: Session, user_id: int, thread_id: str) -> List[dict]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id, ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.id.desc())
        .limit(CHAT_HISTORY_MESSAGES)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


def _run_model(db: Session, user_id: int, messages: List[dict]) -> str:
    tools = build_tools(db, user_id)
    for step in range(CHAT_MAX_TOOL_STEPS):
        final_step = step == CHAT_MAX_TOOL_STEPS - 1
        response = client.chat.completions.create(
            model=CHAT_DEPLOYMENT,
            messages=messages,
            tools=TOOL_SPECS,
            tool_choice="none" if final_step else "auto",
        )
        record_usage(
            db, user_id=user_id, kind="chat", deployment=CHAT_DEPLOYMENT, usage=response.usage
        )
        choice = response.choices[0]
        if choice.finish_reason == "content_filter":
            return _FILTERED_REPLY
        msg = choice.message
        if not msg.tool_calls:
            return (msg.content or "").strip() or _FALLBACK_REPLY

        messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {
                    "id": c.id,
                    "type": "function",
                    "function": {"name": c.function.name, "arguments": c.function.arguments},
                }
                for c in msg.tool_calls
            ],
        })
        for c in msg.tool_calls:
            messages.append({
                "role": "tool",
                "tool_call_id": c.id,
                "content": run_tool(db, tools, c.function.name, c.function.arguments),
            })
    return _FALLBACK_REPLY


def chat_turn(
    db: Session, user_id: int, message: str, thread_id: Optional[str]
) -> Tuple[str, str]:
    """Returns (assistant_reply, thread_id); a new thread id is created when none is sent."""
    thread_id = (thread_id or "").strip()[:64] or uuid.uuid4().hex
    message = message.strip()
    messages = (
        [{"role": "system", "content": _system_prompt(db, user_id)}]
        + _history(db, user_id, thread_id)
        + [{"role": "user", "content": message}]
    )
    try:
        reply = _run_model(db, user_id, messages)
    except BadRequestError as e:
        if getattr(e, "code", None) != "content_filter":
            raise
        reply = _FILTERED_REPLY

    db.add_all([
        ChatMessage(user_id=user_id, thread_id=thread_id, role="user", content=message),
        ChatMessage(user_id=user_id, thread_id=thread_id, role="assistant", content=reply),
    ])
    db.commit()
    return reply, thread_id


def list_threads(db: Session, user_id: int, limit: int = 50) -> List[dict]:
    """Newest threads first; title is the thread's first user message."""
    rows = (
        db.query(
            ChatMessage.thread_id,
            func.min(ChatMessage.id).label("first_id"),
            func.max(ChatMessage.created_at).label("last_message_at"),
        )
        .filter(ChatMessage.user_id == user_id)
        .group_by(ChatMessage.thread_id)
        .order_by(func.max(ChatMessage.created_at).desc())
        .limit(limit)
        .all()
    )
    titles = dict(
        db.query(ChatMessage.id, ChatMessage.content)
        .filter(ChatMessage.id.in_([r.first_id for r in rows]))
        .all()
    )
    return [
        {
            "thread_id": r.thread_id,
            "title": titles.get(r.first_id, "")[:80],
            "last_message_at": r.last_message_at,
        }
        for r in rows
    ]


def get_thread(db: Session, user_id: int, thread_id: str) -> List[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id, ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.id)
        .all()
    )
