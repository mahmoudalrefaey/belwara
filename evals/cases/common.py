"""
Case model for chat evals. Expected values come from the oracle, never typed in by hand.

A Case is a conversation (one or more Turns) for one generated profile. Every turn is also checked
automatically for the critical failures (see run_chat.py); the fields here add what this turn must
get right.
"""

import json
import random
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Callable, Dict, List, Optional, Set, Tuple

from evals.fixtures.oracle import Oracle, month_range

# Tool families: a turn names the kind of lookup it needs, so checks survive tool renames.
FAMILIES: Dict[str, Set[str]] = {
    "aggregate": {"spending_summary"},
    "receipts": {"list_receipts", "find_receipts", "get_receipt", "show_receipts"},
    "detail": {"get_receipt", "list_items", "find_items"},
    "items": {"list_items", "find_items"},
    "overview": {"account_overview", "list_receipts", "find_receipts", "spending_summary"},
    "convert": {"convert_currency", "spending_summary"},
    "action": {"propose_action"},
}

EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
             "October", "November", "December"]
AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر",
             "نوفمبر", "ديسمبر"]


@dataclass
class Turn:
    say: str
    lang: str                                           # en | ar | franco
    amounts: List[Decimal] = field(default_factory=list)       # all must appear
    amounts_any: List[Decimal] = field(default_factory=list)   # at least one must appear
    forbid_amounts: List[Decimal] = field(default_factory=list)
    texts_any: List[str] = field(default_factory=list)  # at least one appears (loose compare)
    texts_none: List[str] = field(default_factory=list)
    tools: Set[str] = field(default_factory=set)        # families; at least one call from each
    no_tools: bool = False                              # must answer without looking anything up
    args: Optional[Callable[[List[dict]], Optional[str]]] = None  # trace → error text or None
    behavior: Optional[str] = None                      # judged rubric key (judge.py)
    facts: str = ""                                     # ground truth shown to the judge
    dims: Set[str] = field(default_factory=set)
    simple: bool = False                                # simple question: tight efficiency budget
    action: bool = False                                # asks to change data


@dataclass
class Case:
    id: str
    profile: str
    turns: List[Turn]
    history: List[dict] = field(default_factory=list)   # conversation that happened before
    tags: Set[str] = field(default_factory=set)


# ── helpers for building cases ─────────────────────────────────────────────

def month_name(d: date, lang: str) -> str:
    if lang == "en":
        return f"{EN_MONTHS[d.month - 1]} {d.year}"
    if lang == "franco":
        return f"shahr {d.month} {d.year}"
    return f"{AR_MONTHS[d.month - 1]} {d.year}"


def months_back(o: Oracle, back: int) -> Tuple[date, date]:
    return month_range(o.today, back)


def money_facts(totals: Dict[str, Decimal]) -> str:
    return ", ".join(f"{v} {c}" for c, v in sorted(totals.items())) or "nothing"


def calls(trace: List[dict], names: Set[str]) -> List[dict]:
    out = []
    for c in trace:
        if c["name"] in names:
            try:
                out.append(json.loads(c["arguments"] or "{}"))
            except ValueError:
                out.append({})
    return out


def check_range(start: date, end: date, *, end_alternatives: Tuple[date, ...] = ()):
    """Some lookup must cover exactly [start, end] (a month may also end on its last calendar day)."""
    ends = {end.isoformat(), *(e.isoformat() for e in end_alternatives)}

    def check(trace):
        for a in calls(trace, {"spending_summary", "list_receipts", "find_receipts", "list_items",
                               "find_items"}):
            if a.get("start") == start.isoformat() and a.get("end") in ends:
                return None
            cmp = a.get("compare_to") or {}
            if cmp.get("start") == start.isoformat() and cmp.get("end") in ends:
                return None
        return f"no lookup for {start}..{sorted(ends)}"
    return check


# What "sorted by amount / date / price" looks like in the tools' sort options.
_SORTS = {"amount": {"largest", "smallest", "amount"}, "date": {"newest", "oldest", "date"},
          "price": {"highest_price", "highest_total", "price"}}


def check_sorted_by(value: str):
    def check(trace):
        for a in calls(trace, {"list_receipts", "find_receipts", "list_items", "find_items"}):
            if a.get("sort") in _SORTS[value]:
                return None
        return f"no lookup sorted by {value}"
    return check


def pick(rng: random.Random, options):
    return rng.choice(list(options))
