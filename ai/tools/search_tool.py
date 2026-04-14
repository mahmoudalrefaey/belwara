from langchain_core.tools import tool
import json
from typing import Optional

from app.core.database import SessionLocal
from app.services.receipt_service import search_receipts


def _format_receipts(receipts) -> str:
    """Serialize receipts to compact JSON without heavy raw OCR text."""

    def receipt_to_dict(receipt):
        if hasattr(receipt, "__table__"):
            # Exclude raw_text to reduce payload size and LLM context cost.
            return {
                c.name: getattr(receipt, c.name)
                for c in receipt.__table__.columns
                if c.name != "raw_text"
            }
        return dict(receipt)

    data = [receipt_to_dict(r) for r in receipts]
    return json.dumps(data, ensure_ascii=False, default=str, separators=(",", ":"))


@tool
def search_tool(query: str, user_id: Optional[int] = None) -> str:
    """
    Tool for agents: Performs a full-text search across receipts in the database.

    Args:
        query (str): Search term (merchant, items, currency, etc.).
        user_id (int, optional): Scope search to a specific user's receipts.

    Returns:
        str: JSON list of matching receipts.
    """
    db = SessionLocal()
    try:
        # Skip raw_text matching for chat search to keep queries and payloads lighter.
        receipts, _ = search_receipts(db, query, user_id=user_id, include_raw=False)
        return _format_receipts(receipts)
    finally:
        db.close()
