"""
Chat tools: typed functions the model may call.

Every tool is bound to one user in code (build_tools); the model never sees or sets user_id, and
every number it reports is computed here, not by the model.

Every result is an envelope the model can act on:
    status       ok | no_results | ambiguous | error
    …data…       rows, receipts, items (amounts are exact decimals as strings, dates YYYY-MM-DD)
    searched     what was looked for, when nothing matched
    limitations  what the figures leave out or can't vouch for
    error        {code, retryable} — never shown to the user as is
"""

import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Callable, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.receipt import COUNTED_STATUSES, Receipt
from app.services import action_service, fx_service, match_service, receipt_service
from app.services.receipt_service import money

log = logging.getLogger(__name__)

_RESULT_ROWS = 50
_CATEGORIES = ["groceries", "dining", "transport", "shopping", "bills", "health", "entertainment", "other"]

STATUS_MEANING = {
    "ready": "read and counted",
    "needs_review": "read and counted, but flagged for the user to check",
    "failed": "upload could not be read at all; not counted",
    "processing": "still being read; not counted yet",
}

# Plain wording for review reasons (same meaning as the app's labels in frontend/messages).
REVIEW_REASONS = {
    "missing_merchant_name": "the merchant name couldn't be read",
    "missing_receipt_date": "the date couldn't be read",
    "missing_total_amount": "the total couldn't be read",
    "missing_currency": "the currency couldn't be told",
    "invalid_total": "the total looks wrong",
    "date_in_future": "the date is in the future",
    "date_too_old": "the date is more than 2 years ago",
    "items_sum_mismatch": "the items don't add up to the total",
    "line_price_mismatch": "an item's price × quantity doesn't match its line total",
    "invalid_currency": "the currency code isn't a real currency",
    "possible_duplicate": "it looks like a receipt that was already uploaded",
    "not_a_receipt": "it doesn't look like a receipt",
    "processing_error": "the file couldn't be read",
}


def _nullable(type_: str, description: str, **extra) -> dict:
    return {"type": [type_, "null"], "description": description, **extra}


_DATE_RANGE = {
    "start": _nullable("string", "Inclusive start date YYYY-MM-DD, or null for no lower bound."),
    "end": _nullable("string", "Inclusive end date YYYY-MM-DD, or null for no upper bound."),
}
_MERCHANT = _nullable("string", "Merchant name as the user wrote it, or null.")
_ALTERNATIVES = {
    "type": ["array", "null"],
    "items": {"type": "string"},
    "description": "Other ways the name may be written on receipts: the other script (Arabic or "
                   "English), a transliteration, a common synonym. Null if none.",
}
_CATEGORY = _nullable("string", "Receipt category, or null.", enum=[*_CATEGORIES, None])
_CURRENCY = _nullable("string", "Only receipts in this ISO currency code, or null for all.")


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
        "Totals per currency: amount, receipt count, average per receipt, tax, other charges, and how "
        "much rests on receipts that need review. Optionally grouped, converted to one currency, or "
        "compared with another period. Use for any total, average, breakdown, trend or comparison.",
        {
            **_DATE_RANGE,
            "group_by": _nullable("string", "Group rows by this, or null for one total per currency.",
                                  enum=["merchant", "category", "month", "day", None]),
            "merchant": _MERCHANT,
            "merchant_alternatives": _ALTERNATIVES,
            "category": _CATEGORY,
            "currency": _CURRENCY,
            "convert_to": _nullable("string", "Also give totals converted into this ISO currency, or null."),
            "compare_start": _nullable("string", "Start of a second period to compare with, or null."),
            "compare_end": _nullable("string", "End of the second period to compare with, or null."),
        },
    ),
    _function(
        "find_receipts",
        "Individual receipts with merchant, date, total, tax, currency, category and review state. "
        "Sort to find the newest, oldest, largest or smallest; search receipt text with `text`.",
        {
            **_DATE_RANGE,
            "merchant": _MERCHANT,
            "merchant_alternatives": _ALTERNATIVES,
            "category": _CATEGORY,
            "currency": _CURRENCY,
            "status": _nullable(
                "string",
                "counted (default: ready + needs_review), needs_review, failed (unreadable uploads), "
                "processing, or all.",
                enum=["counted", "needs_review", "failed", "processing", "all", None],
            ),
            "text": _nullable("string", "Words to find anywhere on a receipt (items, printed text)."),
            "sort": _nullable("string", "Order of results (default newest).",
                              enum=["newest", "oldest", "largest", "smallest", "recently_uploaded", None]),
            "limit": {"type": "integer", "description": "Max rows, 1-50."},
        },
    ),
    _function(
        "get_receipt",
        "One receipt in full: line items with quantities and prices, items total, tax, other charges, "
        "total, review reasons, missing fields, and whether the items add up.",
        {"receipt_id": {"type": "integer"}},
    ),
    _function(
        "find_items",
        "Purchased line items. mode=list gives each purchase (unit_price is the price of one, "
        "line_total is what that line cost: unit_price × quantity); mode=summary groups by item with "
        "times bought, total quantity and total spent.",
        {
            "query": _nullable("string", "Item name as the user wrote it, or null for all items."),
            "query_alternatives": _ALTERNATIVES,
            "merchant": _MERCHANT,
            "merchant_alternatives": _ALTERNATIVES,
            **_DATE_RANGE,
            "mode": {"type": "string", "enum": ["list", "summary"]},
            "sort": _nullable("string", "For mode=list (default newest).",
                              enum=["newest", "highest_price", "highest_total", None]),
            "limit": {"type": "integer", "description": "Max rows, 1-50."},
        },
    ),
    _function(
        "account_overview",
        "What the user has: receipts by status (including failed and still processing), first and "
        "latest receipt dates, currencies, and the receipts that need review with their reasons.",
        {},
    ),
    _function(
        "show_receipts",
        "Attach up to five receipts to your reply as cards the user can tap to open. Use it when the "
        "answer is about specific receipts; don't paste links or ids in the text.",
        {"receipt_ids": {"type": "array", "items": {"type": "integer"}, "description": "1-5 receipt ids."}},
    ),
    _function(
        "propose_action",
        "Prepare a change to one receipt: set_category, mark_reviewed (the user says a flagged receipt "
        "is right) or delete_receipt. Nothing changes until the user taps Confirm on the card that "
        "appears under your reply. Find the exact receipt first (find_receipts).",
        {
            "kind": {"type": "string", "enum": ["set_category", "mark_reviewed", "delete_receipt"]},
            "receipt_id": {"type": "integer"},
            "category": _nullable("string", "New category for set_category, otherwise null.",
                                  enum=[*_CATEGORIES, None]),
        },
    ),
    _function(
        "convert_currency",
        "Convert one amount between currencies at the latest exchange rate.",
        {
            "amount": {"type": "number"},
            "from_currency": {"type": "string", "description": "ISO code, e.g. EGP."},
            "to_currency": {"type": "string", "description": "ISO code, e.g. USD."},
        },
    ),
]


# ═════════════════════════════════════════════════════════════════════════════
#  RESULT SHAPES
# ═════════════════════════════════════════════════════════════════════════════

def _ok(limitations: Optional[List[str]] = None, **data) -> dict:
    out = {"status": "ok", **data}
    if limitations:
        out["limitations"] = limitations
    return out


def _no_results(searched: dict, **extra) -> dict:
    return {"status": "no_results", "searched": {k: v for k, v in searched.items() if v is not None}, **extra}


def _error(code: str, detail: str = "", retryable: bool = False) -> dict:
    return {"status": "error", "error": {"code": code, "detail": detail, "retryable": retryable}}


def _day(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).date().isoformat()
    return value.isoformat()


def _date(value: Optional[str]) -> Optional[date]:
    return date.fromisoformat(value) if value else None


def _limit(value: int) -> int:
    return max(1, min(int(value or _RESULT_ROWS), _RESULT_ROWS))


def _reasons(codes) -> List[str]:
    return [REVIEW_REASONS.get(c, c) for c in (codes or [])]


def _missing(r: Receipt) -> List[str]:
    fields = {"merchant": r.merchant_name, "date": r.receipt_date, "total": r.total_amount,
              "currency": r.currency}
    return [k for k, v in fields.items() if v is None]


def _receipt_row(r: Receipt) -> dict:
    row = {
        "receipt_id": r.receipt_id,
        "merchant": r.merchant_name,
        "date": _day(r.receipt_date),
        "total": money(r.total_amount),
        "currency": r.currency,
        "tax": money(r.total_taxes),
        "category": r.category,
        "status": r.status,
        "verification": r.verification,
    }
    if r.review_reasons:
        row["review_reasons"] = _reasons(r.review_reasons)
    if _missing(r) and r.status in COUNTED_STATUSES:
        row["missing"] = _missing(r)
    return row


def _verification(status: str, confirmed_at) -> str:
    if status == "needs_review":
        return "needs_review"
    return "verified" if confirmed_at else "extracted"


def _quality_notes(rows: List[dict]) -> List[str]:
    notes = []
    missing = sum(r["missing_total"] for r in rows)
    if missing:
        notes.append(f"{missing} receipt(s) in range have no total, so they are not included in the figures.")
    for r in rows:
        if r["needs_review"]:
            notes.append(f"{r['needs_review']} receipt(s) totalling {r['needs_review_amount']} "
                         f"{r['currency']} are included but still need the user's review.")
    if any(r["currency"] is None for r in rows):
        notes.append("Some receipts have no currency; they are listed with currency null.")
    return notes


_SUMMED = ("total", "receipts", "missing_total", "tax", "other_charges", "needs_review",
           "needs_review_amount", "verified")


def _merge_spellings(rows: List[dict], leads: Dict[str, str]) -> List[dict]:
    """Merge merchant rows stored under different spellings of the same merchant."""
    merged: Dict[tuple, dict] = {}
    for r in rows:
        lead = leads.get(r["group"], r["group"])
        key = (lead, r["currency"])
        if key not in merged:
            merged[key] = {**r, "group": lead}
        else:
            m = merged[key]
            for k in _SUMMED:
                if k in r:
                    m[k] = m[k] + r[k]
        if r["group"] != lead:
            merged[key].setdefault("also_stored_as", []).append(r["group"])
    out = list(merged.values())
    for r in out:
        if "receipts" in r:
            r["average"] = money(r["total"] / r["receipts"]) if r["receipts"] else None
    return sorted(out, key=lambda r: r["total"], reverse=True)


# ═════════════════════════════════════════════════════════════════════════════
#  TOOLS
# ═════════════════════════════════════════════════════════════════════════════

def receipt_card(r: Receipt) -> dict:
    """What a receipt card in the chat shows."""
    return {
        "receipt_id": r.receipt_id,
        "merchant": r.merchant_name,
        "date": _day(r.receipt_date),
        "total": str(money(r.total_amount)) if r.total_amount is not None else None,
        "currency": r.currency,
        "category": r.category,
        "status": r.status,
        "verification": r.verification,
    }


def build_tools(
    db: Session, user_id: int, cards: Optional[List[dict]] = None, actions: Optional[list] = None
) -> Dict[str, Callable[..., object]]:
    """
    Tool name → callable, each closed over this request's db session and user. `cards` collects the
    receipt cards show_receipts attaches to this turn's reply; `actions` the changes it proposes.
    """
    cards = cards if cards is not None else []
    actions = actions if actions is not None else []

    def _merchant(name, alternatives, start=None, end=None, category=None):
        """None when no merchant was given; otherwise which stored names the person means."""
        if not name:
            return None
        scoped = bool(start or end or category)
        names = receipt_service.merchant_names(db, user_id, start=start, end=end, category=category)
        return match_service.match_names(name, alternatives, [
            match_service.Candidate(n, c, k if scoped else None) for n, c, k in names
        ])

    def _ambiguous(match, per_group: Callable[[List[str]], dict]) -> dict:
        return {
            "status": "ambiguous",
            "match": match.describe(),
            "candidates": [{"merchant": g.name, **({"also_stored_as": g.variants[1:]} if len(g.variants) > 1
                                                   else {}), **per_group(g.variants)} for g in match.groups],
            "note": "These are different merchants. Report them separately or ask which one is meant.",
        }

    def _data_span(start, end) -> dict:
        """When a period had nothing, say which dates do have receipts."""
        if not (start or end):
            return {}
        o = receipt_service.account_overview(db, user_id)
        if not o["latest_receipt_date"]:
            return {"data_exists": None}
        return {"data_exists": {"first_receipt_date": _day(o["first_receipt_date"]),
                                "latest_receipt_date": _day(o["latest_receipt_date"])}}

    def _leads(rows: List[dict]) -> Dict[str, str]:
        return match_service.cluster_names([(r["group"], r["receipts"]) for r in rows if r.get("group")])

    def _converted(group_by, convert_to, **filters) -> dict:
        buckets = receipt_service.daily_buckets(db, user_id, group_by=group_by, **filters)
        groups: Dict[Optional[str], list] = {}
        for group, day, cur, amount, tax in buckets:
            groups.setdefault(group, []).append((day, cur, amount, tax))
        rows, bases, dates, left_out = [], set(), set(), {}
        for group, items in groups.items():
            c = fx_service.convert(db, [(d, cur, a) for d, cur, a, _ in items], convert_to)
            t = fx_service.convert(db, [(d, cur, x) for d, cur, _, x in items], convert_to)
            rows.append({**({"group": group} if group_by else {}), "total": c.total, "tax": t.total})
            bases.add(c.rate_basis)
            dates.update(c.rate_dates)
            for cur, amount in c.not_converted.items():
                left_out[cur] = money(left_out.get(cur, Decimal(0)) + amount)
        rows.sort(key=lambda r: r["total"], reverse=True)
        basis = bases.pop() if len(bases) == 1 else "mixed"
        out = {
            "to_currency": convert_to.upper(),
            "rows": rows,
            "rate_basis": basis,
            "approximate": basis != "historical",
            "rate_dates": [min(dates), max(dates)] if dates else [],
        }
        if basis == "current":
            out["note"] = "Converted at today's rate, not the rate on each receipt's date."
        if left_out:
            out["not_converted"] = left_out
        return out

    def spending_summary(start, end, group_by, merchant, merchant_alternatives, category, currency,
                         convert_to, compare_start, compare_end):
        s, e = _date(start), _date(end)
        if s and e and s > e:
            return _error("invalid_arguments", "start is after end")
        searched = {"start": start, "end": end, "merchant": merchant, "category": category,
                    "currency": currency, "group_by": group_by}
        match = _merchant(merchant, merchant_alternatives, s, e, category)
        if match and match.status == "no_results":
            return _no_results(searched, match=match.describe())
        if match and match.status == "ambiguous":
            return _ambiguous(match, lambda names: {"rows": receipt_service.spending_summary(
                db, user_id, start=s, end=e, merchants=names, category=category, currency=currency)})
        filters = dict(merchants=match.matched if match else None, category=category, currency=currency)
        rows = receipt_service.spending_summary(db, user_id, start=s, end=e, group_by=group_by, **filters)
        if not rows:
            return _no_results(searched, **({"match": match.describe()} if match else {}),
                               **_data_span(s, e))
        leads = _leads(rows) if group_by == "merchant" else {}
        if leads:
            rows = _merge_spellings(rows, leads)
        out = {"rows": rows}
        if match:
            out["match"] = match.describe()
        if s and e:
            days = (min(e, date.today()) - s).days + 1
            if days > 0:
                per_currency: Dict[Optional[str], Decimal] = {}
                for r in rows:
                    per_currency[r["currency"]] = per_currency.get(r["currency"], Decimal(0)) + r["total"]
                out["period"] = {
                    "start": start, "end": end, "days_counted": days,
                    "daily_average": [{"currency": c, "per_day": money(t / days)}
                                      for c, t in per_currency.items()],
                }
                if not group_by:
                    for r in rows:
                        r["daily_average"] = money(r["total"] / days)
        if convert_to and group_by in (None, "merchant", "category", "month"):
            out["converted"] = _converted(group_by, convert_to, start=s, end=e, **filters)
            if leads:
                out["converted"]["rows"] = _merge_spellings(out["converted"]["rows"], leads)
        if compare_start or compare_end:
            cs, ce = _date(compare_start), _date(compare_end)
            other = receipt_service.spending_summary(db, user_id, start=cs, end=ce, group_by=group_by,
                                                     **filters)
            if group_by == "merchant":
                other = _merge_spellings(other, {**_leads(other), **leads})
            key = lambda r: (r.get("group"), r["currency"])  # noqa: E731
            mine, theirs = {key(r): r for r in rows}, {key(r): r for r in other}
            changes = []
            for k in sorted(set(mine) | set(theirs), key=lambda k: (str(k[0]), str(k[1]))):
                a = mine[k]["total"] if k in mine else Decimal("0.00")
                b = theirs[k]["total"] if k in theirs else Decimal("0.00")
                changes.append({
                    **({"group": k[0]} if group_by else {}),
                    "currency": k[1],
                    "this_period": a,
                    "compare_period": b,
                    "difference": money(a - b),
                    "percent_change": money((a - b) / b * 100) if b else None,
                })
            out["comparison"] = {"compare_period": {"start": compare_start, "end": compare_end},
                                 "rows": other, "changes": changes}
        return _ok(_quality_notes(rows), **out)

    def find_receipts(start, end, merchant, merchant_alternatives, category, currency, status, text, sort,
                      limit):
        statuses = {None: COUNTED_STATUSES, "counted": COUNTED_STATUSES, "all": None}.get(status, [status])
        sort = sort or "newest"
        searched = {"start": start, "end": end, "merchant": merchant, "category": category,
                    "currency": currency, "status": status, "text": text}
        match = _merchant(merchant, merchant_alternatives, _date(start), _date(end), category)
        if match and match.status == "no_results":
            return _no_results(searched, match=match.describe())
        kwargs = dict(start=_date(start), end=_date(end), merchants=match.matched if match else None,
                      category=category, currency=currency, statuses=statuses, text=text, sort=sort)
        if match and match.status == "ambiguous":
            def receipts_of(names):
                rows, n = receipt_service.list_receipts_page(db, user_id, limit=3, offset=0,
                                                             **{**kwargs, "merchants": names})
                return {"total_matching": n, "receipts": [_receipt_row(r) for r in rows]}
            return _ambiguous(match, receipts_of)
        if sort in ("largest", "smallest") and not currency:
            # Amounts in different currencies can't be ranked against each other.
            by_currency = {}
            total = 0
            for cur in [c["currency"] for c in receipt_service.account_overview(db, user_id)["currencies"]]:
                if cur is None:
                    continue
                rows, n = receipt_service.list_receipts_page(
                    db, user_id, limit=min(_limit(limit), 5), offset=0, **{**kwargs, "currency": cur})
                if rows:
                    by_currency[cur] = [_receipt_row(r) for r in rows]
                    total += n
            if not by_currency:
                return _no_results(searched, **({"match": match.describe()} if match else {}))
            return _ok(
                ["Ranked within each currency; amounts in different currencies are not comparable."]
                if len(by_currency) > 1 else None,
                sort=sort, total_matching=total, by_currency=by_currency,
            )
        rows, total = receipt_service.list_receipts_page(db, user_id, limit=_limit(limit), offset=0, **kwargs)
        extra = {"match": match.describe()} if match else {}
        if not rows:
            return _no_results(searched, **extra, **_data_span(_date(start), _date(end)))
        return _ok(sort=sort, total_matching=total, receipts=[_receipt_row(r) for r in rows], **extra)

    def get_receipt(receipt_id):
        r = receipt_service.get_receipt_by_id(db, int(receipt_id), user_id)
        if r is None:
            return _no_results({"receipt_id": receipt_id})
        items_total = money(sum((i.line_total for i in r.items), Decimal(0)))
        row = _receipt_row(r)
        row.update(
            other_charges=money(r.other),
            items=[{"name": i.item_name, "quantity": i.quantity, "unit_price": money(i.unit_price),
                    "line_total": money(i.line_total)} for i in r.items],
            items_total=items_total,
            link=f"/receipts?open={r.receipt_id}",
        )
        notes = []
        if r.items and r.total_amount is not None:
            expected = [money(r.total_amount), money(r.total_amount - r.total_taxes - r.other)]
            row["items_match_total"] = any(abs(items_total - x) <= max(Decimal("0.05"), x * Decimal("0.02"))
                                           for x in expected)
            if not row["items_match_total"]:
                notes.append("The line items don't add up to the receipt total; one of them may be misread.")
        if r.verification != "verified":
            notes.append("Values were read from the photo automatically"
                         + (" and are flagged for review." if r.status == "needs_review" else "."))
        return _ok(notes, receipt=row)

    def find_items(query, query_alternatives, merchant, merchant_alternatives, start, end, mode, sort, limit):
        s, e = _date(start), _date(end)
        searched = {"query": query, "merchant": merchant, "start": start, "end": end}
        match = _merchant(merchant, merchant_alternatives, s, e)
        if match and match.status == "no_results":
            return _no_results(searched, match=match.describe())
        if match and match.status == "ambiguous":
            return _ambiguous(match, lambda names: {"items_bought": sum(
                n for _, n in receipt_service.item_names(db, user_id, merchants=names, start=s, end=e))})
        merchants = match.matched if match else None
        extra = {"match": match.describe()} if match else {}
        names = None
        if query:
            found = match_service.match_names(
                query, query_alternatives, receipt_service.item_names(db, user_id, merchants=merchants,
                                                                      start=s, end=e), union=True)
            extra["item_match"] = found.describe()
            if found.status != "ok":
                return _no_results(searched, **extra)
            names = found.matched
        kwargs = dict(names=names, merchants=merchants, start=s, end=e)
        if mode == "summary":
            rows = receipt_service.item_summary(db, user_id, **kwargs)
            if not rows:
                return _no_results(searched, **extra)
            out = {"items": [{**r, "last_bought": _day(r["last_bought"])} for r in rows]}
            if names and len(rows) > 1:
                # The person asked about one thing stored under several names: give the whole.
                combined: Dict[Optional[str], dict] = {}
                for r in rows:
                    c = combined.setdefault(r["currency"], {"currency": r["currency"], "times": 0,
                                                            "quantity": Decimal(0), "spent": Decimal(0)})
                    c["times"] += r["times"]
                    c["quantity"] += r["quantity"]
                    c["spent"] = money(c["spent"] + r["spent"])
                out["all_matching_items"] = list(combined.values())
            return _ok(**out, **extra)
        rows = receipt_service.list_items(db, user_id, sort=sort or "newest", limit=_limit(limit), **kwargs)
        if not rows:
            return _no_results(searched, **extra)
        return _ok(items=[{
            "item": r["item_name"], "quantity": r["quantity"], "unit_price": money(r["unit_price"]),
            "line_total": money(r["line_total"]), "currency": r["currency"], "merchant": r["merchant_name"],
            "date": _day(r["receipt_date"]), "receipt_id": r["receipt_id"],
            "verification": _verification(r["status"], r["confirmed_at"]),
        } for r in rows], **extra)

    def account_overview():
        o = receipt_service.account_overview(db, user_id)
        if not o["receipts_by_status"]:
            return _no_results({"receipts": "any"})
        return _ok(
            receipts_by_status=o["receipts_by_status"],
            status_meaning={k: v for k, v in STATUS_MEANING.items() if k in o["receipts_by_status"]},
            first_receipt_date=_day(o["first_receipt_date"]),
            latest_receipt_date=_day(o["latest_receipt_date"]),
            last_upload_date=_day(o["last_upload_at"]),
            currencies=o["currencies"],
            needs_review=[_receipt_row(r) for r in o["needs_review"]],
        )

    def show_receipts(receipt_ids):
        wanted = list(dict.fromkeys(int(i) for i in receipt_ids))[:5]
        found = {r.receipt_id: r for r in db.query(Receipt).filter(
            Receipt.user_id == user_id, Receipt.receipt_id.in_(wanted)).all()} if wanted else {}
        for rid in wanted:
            if rid in found and all(c["receipt_id"] != rid for c in cards):
                cards.append(receipt_card(found[rid]))
        missing = [i for i in wanted if i not in found]
        if not found:
            return _no_results({"receipt_ids": wanted})
        return _ok(["Some ids are not this user's receipts and were not shown."] if missing else None,
                   shown=[i for i in wanted if i in found],
                   note="The cards appear under your reply; there is no need to repeat their details.")

    def propose_action(kind, receipt_id, category):
        p = action_service.propose(db, user_id, kind=kind, receipt_id=int(receipt_id), category=category)
        if p.status != "pending_confirmation":
            return {"status": p.status, "reason": p.reason}
        actions.append(p.action)
        return {
            "status": "pending_confirmation",
            "action_id": p.action.action_id,
            "receipt": {"receipt_id": p.action.receipt_id, **p.action.summary},
            "note": "Nothing has changed yet. A card under your reply lets the user confirm or cancel; "
                    "tell them that, and don't say it's done.",
        }

    def convert_currency(amount, from_currency, to_currency):
        src, dst = from_currency.strip().upper(), to_currency.strip().upper()
        value = Decimal(str(amount))
        if src == dst:
            return _ok(amount=money(value), currency=dst)
        try:
            c = fx_service.convert(db, [(None, src, value)], dst)
        except ValueError as e:
            return _error("unknown_currency", str(e))
        if c.not_converted:
            return _error("unknown_currency", f"No exchange rate for {src}.")
        return _ok(amount=money(value), from_currency=src, converted=c.total, to_currency=dst,
                   rate_basis=c.rate_basis, approximate=True,
                   rate_date=c.rate_dates[0] if c.rate_dates else None)

    return {
        "spending_summary": spending_summary,
        "find_receipts": find_receipts,
        "get_receipt": get_receipt,
        "find_items": find_items,
        "account_overview": account_overview,
        "show_receipts": show_receipts,
        "propose_action": propose_action,
        "convert_currency": convert_currency,
    }


def run_tool(db: Session, tools: Dict[str, Callable[..., object]], name: str, arguments: str) -> str:
    """Execute one tool call and return its JSON envelope (errors are returned, not raised)."""
    fn = tools.get(name)
    if fn is None:
        result = _error("unknown_tool", name)
    else:
        try:
            result = fn(**json.loads(arguments or "{}"))
        except (ValueError, TypeError) as e:  # bad date strings, bad JSON, wrong argument names
            result = _error("invalid_arguments", str(e))
        except fx_service.RatesUnavailable:
            result = _error("rates_unavailable", "Exchange rates are unavailable.", retryable=True)
        except Exception:
            log.exception("Tool %s failed", name)
            db.rollback()  # keep the session usable for the next call
            result = _error("internal", "The data could not be loaded.", retryable=True)
    return json.dumps(result, default=str, ensure_ascii=False)
