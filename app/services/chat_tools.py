"""
Chat tools: typed functions the model may call.

Every tool is bound to one user in code (build_tools); the model never sees or sets user_id,
and every number it reports is computed here, not by the model.
"""

import json
import logging
import time
from datetime import date
from typing import Callable, Dict, Optional

import requests
from sqlalchemy.orm import Session

from app.config import CURRENCYFREAKS_API_KEY
from app.services import receipt_service

log = logging.getLogger(__name__)

_RESULT_ROWS = 50


def _nullable(type_: str, description: str, **extra) -> dict:
    return {"type": [type_, "null"], "description": description, **extra}


_DATE_RANGE = {
    "start": _nullable("string", "Inclusive start date YYYY-MM-DD, or null for no lower bound."),
    "end": _nullable("string", "Inclusive end date YYYY-MM-DD, or null for no upper bound."),
}
_CATEGORY = _nullable(
    "string",
    "Receipt category filter, or null.",
    enum=["groceries", "dining", "transport", "shopping", "bills", "health", "entertainment", "other", None],
)


def _function(name: str, description: str, properties: dict) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "strict": True,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": list(properties),
                "additionalProperties": False,
            },
        },
    }


TOOL_SPECS = [
    _function(
        "spending_summary",
        "Total spent and receipt count, split by currency, optionally grouped. "
        "Use for totals, averages, top merchants/categories, and month-by-month trends.",
        {
            **_DATE_RANGE,
            "group_by": _nullable(
                "string", "Group rows by this, or null for one total per currency.",
                enum=["merchant", "month", "category", None],
            ),
            "merchant": _nullable("string", "Merchant name (partial match), or null."),
            "category": _CATEGORY,
        },
    ),
    _function(
        "list_receipts",
        "Individual receipts (newest first) with merchant, date, total, currency and category.",
        {
            **_DATE_RANGE,
            "merchant": _nullable("string", "Merchant name (partial match), or null."),
            "category": _CATEGORY,
            "limit": {"type": "integer", "description": "Max rows, 1-50."},
        },
    ),
    _function(
        "list_items",
        "Purchased line items (newest first) with quantity, prices, merchant and date.",
        {
            "query": _nullable("string", "Item name (partial match), or null for all items."),
            "merchant": _nullable("string", "Merchant name (partial match), or null."),
            **_DATE_RANGE,
            "limit": {"type": "integer", "description": "Max rows, 1-50."},
        },
    ),
    _function(
        "convert_currency",
        "Convert an amount between currencies at the latest exchange rate.",
        {
            "amount": {"type": "number"},
            "from_currency": {"type": "string", "description": "ISO code, e.g. EGP."},
            "to_currency": {"type": "string", "description": "ISO code, e.g. USD."},
        },
    ),
]


# ═════════════════════════════════════════════════════════════════════════════
#  CURRENCY (CurrencyFreaks, USD-based; rates cached for an hour)
# ═════════════════════════════════════════════════════════════════════════════

_RATES_URL = "https://api.currencyfreaks.com/v2.0/rates/latest"
_RATES_TTL_SECONDS = 3600
_rates_cache: dict = {}


def _usd_rates() -> dict:
    if _rates_cache and time.time() - _rates_cache["fetched_at"] < _RATES_TTL_SECONDS:
        return _rates_cache
    r = requests.get(_RATES_URL, params={"apikey": CURRENCYFREAKS_API_KEY}, timeout=10)
    r.raise_for_status()
    data = r.json()
    _rates_cache.update(
        fetched_at=time.time(),
        date=data.get("date"),
        rates={k: float(v) for k, v in (data.get("rates") or {}).items()},
    )
    return _rates_cache


def convert_currency(amount: float, from_currency: str, to_currency: str) -> dict:
    src, dst = from_currency.strip().upper(), to_currency.strip().upper()
    if src == dst:
        return {"amount": amount, "currency": dst}
    if not CURRENCYFREAKS_API_KEY:
        return {"error": "Currency conversion is not available."}
    try:
        cache = _usd_rates()
    except requests.RequestException:
        log.exception("Currency rates fetch failed")
        return {"error": "Exchange rates are temporarily unavailable."}
    rate_src, rate_dst = cache["rates"].get(src), cache["rates"].get(dst)
    if not rate_src or not rate_dst:
        return {"error": f"Unknown currency code {src if not rate_src else dst}."}
    return {
        "amount": amount,
        "from_currency": src,
        "converted": round(amount * rate_dst / rate_src, 2),
        "to_currency": dst,
        "rate_date": cache["date"],
    }


# ═════════════════════════════════════════════════════════════════════════════
#  BINDING + DISPATCH
# ═════════════════════════════════════════════════════════════════════════════

def _date(value: Optional[str]) -> Optional[date]:
    return date.fromisoformat(value) if value else None


def _limit(value: int) -> int:
    return max(1, min(int(value or _RESULT_ROWS), _RESULT_ROWS))


def build_tools(db: Session, user_id: int) -> Dict[str, Callable[..., object]]:
    """Tool name → callable, each closed over this request's db session and user."""

    def spending_summary(start, end, group_by, merchant, category):
        return receipt_service.spending_summary(
            db, user_id, start=_date(start), end=_date(end),
            group_by=group_by, merchant=merchant, category=category,
        )

    def list_receipts(start, end, merchant, category, limit):
        rows, total = receipt_service.list_receipts_page(
            db, user_id, limit=_limit(limit), offset=0,
            start=_date(start), end=_date(end), merchant=merchant, category=category,
        )
        return {
            "total_matching": total,
            "receipts": [
                {
                    "receipt_id": r.receipt_id,
                    "merchant": r.merchant_name,
                    "date": r.receipt_date,
                    "total": r.total_amount,
                    "currency": r.currency,
                    "category": r.category,
                    "status": r.status,
                }
                for r in rows
            ],
        }

    def list_items(query, merchant, start, end, limit):
        return receipt_service.list_items(
            db, user_id, query=query, merchant=merchant,
            start=_date(start), end=_date(end), limit=_limit(limit),
        )

    return {
        "spending_summary": spending_summary,
        "list_receipts": list_receipts,
        "list_items": list_items,
        "convert_currency": convert_currency,
    }


def run_tool(db: Session, tools: Dict[str, Callable[..., object]], name: str, arguments: str) -> str:
    """Execute one tool call and return its JSON result (errors are returned, not raised)."""
    fn = tools.get(name)
    if fn is None:
        return json.dumps({"error": f"Unknown tool {name}."})
    try:
        result = fn(**json.loads(arguments or "{}"))
    except ValueError as e:  # bad date strings, bad JSON
        result = {"error": f"Invalid arguments: {e}"}
    except Exception:
        log.exception("Tool %s failed", name)
        db.rollback()  # keep the session usable for the next call
        result = {"error": "The data could not be loaded."}
    return json.dumps(result, default=str, ensure_ascii=False)
