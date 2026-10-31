"""
Expected answers computed in plain Python from the generated ground truth.

Independent of app/services: amounts come from what the app *stores* (that is all it can know),
while identity (which receipts belong to which real merchant, even under a damaged name) comes from
the ground truth. Only ready and needs_review receipts with a total count, like the app's rule.
"""

import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Dict, List, Optional

from evals.fixtures.generate import RESULTS

COUNTED = ("ready", "needs_review")
CENT = Decimal("0.01")


def q2(x: Decimal) -> Decimal:
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass
class R:
    """A ground-truth receipt with parsed types."""

    ref: str
    receipt_id: int
    merchant_key: Optional[str]
    merchant_name: Optional[str]
    stored_merchant: Optional[str]
    day: Optional[date]
    uploaded_at: str
    currency: Optional[str]
    total: Optional[Decimal]
    tax: Decimal
    other: Decimal
    category: Optional[str]
    status: str
    reasons: List[str]
    verified: bool
    items: List[dict]

    @property
    def counted(self) -> bool:
        return self.status in COUNTED and self.total is not None


def month_range(today: date, back: int):
    """(first day, last day) of the month `back` months before today's; the current month ends today."""
    months = today.year * 12 + (today.month - 1) - back
    start = date(months // 12, months % 12 + 1, 1)
    nxt = date((months + 1) // 12, (months + 1) % 12 + 1, 1)
    return start, (today if back == 0 else nxt - timedelta(days=1))


class Oracle:
    def __init__(self, profile: dict, today: date):
        self.name = profile["name"]
        self.user_id = profile["user_id"]
        self.today = today
        self.receipts = [
            R(r["ref"], r["receipt_id"], r["merchant_key"], r["merchant_name"], r["stored_merchant"],
              date.fromisoformat(r["receipt_date"]) if r["receipt_date"] else None, r["uploaded_at"],
              r["currency"], Decimal(r["total"]) if r["total"] is not None else None,
              Decimal(r["tax"]), Decimal(r["other"]), r["category"], r["status"], r["reasons"] or [],
              r["verified"], r["items"])
            for r in profile["receipts"]
        ]

    # ── selection ──────────────────────────────────────────────────────────
    def select(self, *, start=None, end=None, merchant=None, category=None, currency=None,
               counted=True) -> List[R]:
        out = []
        for r in self.receipts:
            if counted and not r.counted:
                continue
            if start and (r.day is None or r.day < start):
                continue
            if end and (r.day is None or r.day > end):
                continue
            if merchant and r.merchant_key != merchant:
                continue
            if category and r.category != category:
                continue
            if currency and r.currency != currency:
                continue
            out.append(r)
        return out

    # ── aggregates ─────────────────────────────────────────────────────────
    def totals(self, **f) -> Dict[str, Decimal]:
        out: Dict[str, Decimal] = defaultdict(Decimal)
        for r in self.select(**f):
            out[r.currency] += r.total
        return {c: q2(v) for c, v in out.items()}

    def counts(self, **f) -> Dict[str, int]:
        out: Dict[str, int] = defaultdict(int)
        for r in self.select(**f):
            out[r.currency] += 1
        return dict(out)

    def tax_totals(self, **f) -> Dict[str, Decimal]:
        out: Dict[str, Decimal] = defaultdict(Decimal)
        for r in self.select(**f):
            out[r.currency] += r.tax
        return {c: q2(v) for c, v in out.items() if v}

    def daily_average(self, start: date, end: date, currency: str) -> Decimal:
        days = (min(end, self.today) - start).days + 1
        return q2(self.totals(start=start, end=end).get(currency, Decimal(0)) / days)

    def by(self, field: str, currency: str, **f) -> List[tuple]:
        out: Dict[str, Decimal] = defaultdict(Decimal)
        for r in self.select(currency=currency, **f):
            out[getattr(r, field)] += r.total
        return sorted(((k, q2(v)) for k, v in out.items()), key=lambda kv: -kv[1])

    def biggest(self, currency: Optional[str] = None) -> R:
        return max(self.select(currency=currency), key=lambda r: r.total)

    def smallest(self, currency: Optional[str] = None) -> R:
        return min(self.select(currency=currency), key=lambda r: r.total)

    def latest(self, **f) -> Optional[R]:
        rows = [r for r in self.select(counted=False, **f) if r.day]
        return max(rows, key=lambda r: (r.day, r.uploaded_at)) if rows else None

    def oldest(self) -> Optional[R]:
        rows = [r for r in self.receipts if r.day and r.status in COUNTED]
        return min(rows, key=lambda r: r.day) if rows else None

    def latest_upload(self) -> R:
        return max(self.receipts, key=lambda r: r.uploaded_at)

    def status_counts(self) -> Dict[str, int]:
        out: Dict[str, int] = defaultdict(int)
        for r in self.receipts:
            out[r.status] += 1
        return dict(out)

    # ── merchants and items ────────────────────────────────────────────────
    def merchant_keys(self) -> Dict[str, int]:
        out: Dict[str, int] = defaultdict(int)
        for r in self.receipts:
            if r.merchant_key and r.status in COUNTED:
                out[r.merchant_key] += 1
        return dict(out)

    def stored_names(self, merchant_key: str) -> List[str]:
        return sorted({r.stored_merchant for r in self.receipts
                       if r.merchant_key == merchant_key and r.stored_merchant})

    def item_stats(self, item_key: str) -> Dict[str, dict]:
        """Per currency: spent (sum of line totals), quantity, times bought."""
        out: Dict[str, dict] = {}
        for r in self.select():
            for it in r.items:
                if it["key"] != item_key:
                    continue
                s = out.setdefault(r.currency, {"spent": Decimal(0), "quantity": Decimal(0), "times": 0})
                s["spent"] += Decimal(it["line_total"])
                s["quantity"] += Decimal(it["quantity"])
                s["times"] += 1
        for s in out.values():
            s["spent"] = q2(s["spent"])
        return out

    def item_keys(self) -> Dict[str, int]:
        out: Dict[str, int] = defaultdict(int)
        for r in self.select():
            for it in r.items:
                if it["key"] != "injection":
                    out[it["key"]] += 1
        return dict(out)

    def most_expensive_item(self, currency: str) -> dict:
        rows = [(Decimal(it["unit_price"]), Decimal(it["line_total"]), it, r)
                for r in self.select(currency=currency) for it in r.items if it["key"] != "injection"]
        by_unit = max(rows, key=lambda x: x[0])
        by_line = max(rows, key=lambda x: x[1])
        return {"unit": by_unit, "line": by_line}


def load(pool: str) -> dict:
    path = Path(RESULTS) / f"{pool}.json"
    if not path.exists():
        raise SystemExit(f"{path} not found; run: python -m evals.fixtures.generate --pool {pool} --seed N")
    data = json.loads(path.read_text(encoding="utf-8"))
    today = date.fromisoformat(data["today"])
    data["oracles"] = {p["name"]: Oracle(p, today) for p in data["profiles"]}
    data["today_date"] = today
    return data
