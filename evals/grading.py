"""
Deterministic checks on one assistant reply.

Grounding: every money-like number in a reply (has decimals, sits next to a currency, or is a
percentage) must appear in a tool result from this conversation or in the user's own words.
Rounding a grounded value to whole units is accepted; any other number is "ungrounded", which is
how arithmetic done by the model (sums, differences, mixed-currency totals) shows up.
"""

import json
import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Dict, Iterable, List, Optional, Set, Tuple

CENT = Decimal("0.01")
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
# A standalone number: not glued to letters ("3al", "3.5X", "3لتر" are words, not amounts).
_NUMBER = re.compile(r"(?<![\w.])(?:\d{1,3}(?:[,٬]\d{3})+(?:[.٫]\d+)?|\d+(?:[.٫]\d+)?)(?![\w.]\w)(?!\w)")
_DATE = re.compile(r"\d{4}-\d{1,2}-\d{1,2}|\d{1,2}/\d{1,2}/\d{2,4}|\d{1,2}-\d{1,2}-\d{4}")

# Words and symbols that name a currency in replies → the ISO codes they may mean.
_CURRENCY_WORDS: List[Tuple[str, Set[str]]] = [
    (r"جنيه(?:\s*مصري)?|ج\.م|\bLE\b|\bgeneh\b|\bgneh\b|\bginih\b|\bpounds?\b", {"EGP", "GBP"}),
    (r"ريال\s*سعودي|ر\.س|\briyals?\b|ريال", {"SAR", "QAR", "OMR", "YER"}),
    (r"درهم|د\.إ|\bdirhams?\b", {"AED", "MAD"}),
    (r"يورو|\beuros?\b|€", {"EUR"}),
    (r"دولار|\bdollars?\b|\$", {"USD"}),
    (r"دينار|\bdinars?\b", {"KWD", "JOD", "BHD"}),
    (r"ليرة|\blira\b", {"TRY", "LBP"}),
    (r"£", {"GBP", "EGP"}),
]
_ISO = re.compile(r"\b[A-Z]{3}\b")


def normalize(s: str) -> str:
    """Loose text form for comparing names in replies (eval side, independent of the app)."""
    s = unicodedata.normalize("NFKC", s or "").translate(_DIGITS).casefold()
    s = re.sub(r"[ً-ٰٟـ]", "", s)
    s = s.translate(str.maketrans("أإآٱىة", "اااايه"))
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _to_decimal(raw: str) -> Optional[Decimal]:
    raw = raw.translate(_DIGITS).replace("٫", ".")
    if re.search(r"[,٬]\d{3}", raw):
        raw = raw.replace(",", "").replace("٬", "")
    try:
        return Decimal(raw)
    except InvalidOperation:
        return None


# Codes a reply may use as a currency (anything else in capitals, like VAT, is not one).
ISO_CODES = set("""AED AUD BHD CAD CHF CNY DKK EGP EUR GBP HKD INR JOD JPY KWD LBP MAD NOK OMR QAR
RUB SAR SEK SGD TND TRY USD YER ZAR""".split())


def _currency_near(text: str, start: int, end: int, codes: Set[str]) -> Set[str]:
    after, before = text[end:end + 16], text[max(0, start - 12):start]
    found: Set[str] = set()
    m = re.match(r"\s*([A-Z]{3})\b", after)
    if m and m.group(1) in codes:
        found.add(m.group(1))
    m = re.search(r"\b([A-Z]{3})\s*$", before)
    if m and m.group(1) in codes:
        found.add(m.group(1))
    for pattern, names in _CURRENCY_WORDS:
        named_after = re.match(r"\s*(?:" + pattern + ")", after, re.I)
        if named_after or re.search("(?:" + pattern + r")\s*$", before, re.I):
            found |= names
    return found


def money_mentions(reply: str, codes: Optional[Set[str]] = None) -> List[Tuple[Decimal, Set[str], str]]:
    """(value, currencies named next to it, raw text) for each money-like number in a reply."""
    codes = ISO_CODES | (codes or set())
    text = _DATE.sub(lambda m: " " * len(m.group()), reply.translate(_DIGITS))
    out = []
    for m in _NUMBER.finditer(text):
        raw = m.group()
        value = _to_decimal(raw)
        if value is None:
            continue
        currencies = _currency_near(text, m.start(), m.end(), codes)
        is_percent = text[m.end():m.end() + 2].lstrip().startswith(("%", "٪"))
        has_decimals = bool(re.search(r"[.٫]\d", raw))
        if currencies or is_percent or has_decimals:
            out.append((value, currencies, raw))
    return out


def tool_numbers(trace: Iterable[dict]) -> Dict[Decimal, Set[Optional[str]]]:
    """Every number in tool results → the currencies it was reported in (None = no currency)."""
    found: Dict[Decimal, Set[Optional[str]]] = {}

    def add(value, currency):
        d = _to_decimal(str(value)) if not isinstance(value, bool) else None
        if d is not None:
            found.setdefault(d.quantize(CENT, rounding=ROUND_HALF_UP), set()).add(currency)

    def walk(node, currency):
        if isinstance(node, dict):
            own = node.get("currency") if isinstance(node.get("currency"), str) else currency
            for key, value in node.items():
                cur = own
                if key.startswith(("converted", "combined")):
                    cur = node.get("to_currency") or node.get("convert_to") or own
                elif key == "amount" and node.get("from_currency"):
                    cur = node["from_currency"]
                if isinstance(value, (dict, list)):
                    walk(value, cur)
                elif isinstance(value, (int, float)) or (
                        isinstance(value, str) and re.fullmatch(r"-?\d+(?:\.\d+)?", value)):
                    add(value, cur)
                elif isinstance(value, str):
                    # Numbers printed inside text (an item named "0.75X cheese") may be quoted back.
                    for raw in _NUMBER.findall(value.translate(_DIGITS)):
                        add(raw, None)
        elif isinstance(node, list):
            for v in node:
                walk(v, currency)

    for call in trace:
        try:
            walk(json.loads(call["result"]), None)
        except (ValueError, TypeError):
            continue
    return found


def grounding(reply: str, trace: List[dict], user_text: str) -> Tuple[List[str], List[str]]:
    """Returns (ungrounded numbers, numbers named in a currency the data doesn't support)."""
    known = tool_numbers(trace)
    user_numbers = {d.quantize(CENT) for d in (_to_decimal(x) for x in _NUMBER.findall(
        user_text.translate(_DIGITS))) if d is not None}
    ungrounded, mismatched = [], []
    data_codes = {c for cs in known.values() for c in cs if c}
    for value, currencies, raw in money_mentions(reply, data_codes):
        v = value.quantize(CENT, rounding=ROUND_HALF_UP)
        sources = known.get(v)
        if sources is None and value == value.to_integral_value():
            # Accept a grounded value shown rounded to whole units.
            near = [k for k in known if abs(k - value) < 1]
            sources = set().union(*(known[k] for k in near)) if near else None
        if sources is None:
            if v not in user_numbers:
                ungrounded.append(raw)
            continue
        named = {c for c in sources if c}
        if currencies and named and not (currencies & named):
            mismatched.append(f"{raw} {'/'.join(sorted(currencies))} (data: {'/'.join(sorted(named))})")
    return ungrounded, mismatched


def amount_present(reply: str, value: Decimal) -> bool:
    target = Decimal(value).quantize(CENT)
    for v, _, _ in money_mentions(reply) + [(d, set(), "") for d in _plain_numbers(reply)]:
        if v.quantize(CENT, rounding=ROUND_HALF_UP) == target:
            return True
    return False


def _plain_numbers(reply: str) -> List[Decimal]:
    return [d for d in (_to_decimal(x) for x in _NUMBER.findall(reply.translate(_DIGITS))) if d is not None]


def text_present(reply: str, needle: str) -> bool:
    return normalize(needle) in normalize(reply)


def language_of(reply: str) -> str:
    arabic = len(re.findall(r"[؀-ۿ]", reply))
    latin = len(re.findall(r"[A-Za-z]", reply))
    if arabic > latin:
        return "ar"
    franco = re.findall(r"\b[a-z]*[2357][a-z]+\b|\b(?:ana|enta|enty|eh|ezay|kam|keda|bas|3la|fe|w)\b",
                        reply, re.I)
    return "franco" if len(franco) >= 2 else "en"
