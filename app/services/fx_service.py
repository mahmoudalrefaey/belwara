"""
Exchange rates with an explicit basis (CurrencyFreaks, USD-based).

- current: latest published rates, cached for an hour.
- historical: the rate on a receipt's date. Fetched once per date and kept in `fx_rates`, since
  published rates never change. Historical rates need a paid CurrencyFreaks plan; when the API
  refuses (402/403) the service stops asking for the rest of the process and falls back to current.

Every conversion says which basis it used; a conversion at today's rate is always marked
approximate.
"""

import logging
import time
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict, Iterable, List, Optional, Tuple

import requests
from sqlalchemy.orm import Session

from app.config import CURRENCYFREAKS_API_KEY
from app.models.fx import FxRate

log = logging.getLogger(__name__)

_BASE = "https://api.currencyfreaks.com/v2.0/rates"
_CURRENT_TTL_SECONDS = 3600
_MAX_FETCHES_PER_CALL = 12  # historical dates fetched in one conversion; the rest use today's rate
_CENT = Decimal("0.01")

_current: dict = {}
_historical_available: Optional[bool] = None  # None = not tried yet


class RatesUnavailable(Exception):
    """No rates could be loaded (no API key, network failure)."""


@dataclass
class Conversion:
    total: Decimal
    currency: str
    rate_basis: str           # "historical" | "current" | "mixed"
    approximate: bool
    rate_dates: List[str]
    not_converted: Dict[str, Decimal]  # currency → amount left out (unknown or invalid code)


def _money(x: Decimal) -> Decimal:
    return x.quantize(_CENT, rounding=ROUND_HALF_UP)


def _get(path: str, **params) -> requests.Response:
    return requests.get(f"{_BASE}/{path}", params={"apikey": CURRENCYFREAKS_API_KEY, **params}, timeout=10)


def current_rates() -> Tuple[str, Dict[str, Decimal]]:
    """(rate date, {currency: units per USD}) for the latest published rates."""
    if _current and time.time() - _current["fetched_at"] < _CURRENT_TTL_SECONDS:
        return _current["date"], _current["rates"]
    if not CURRENCYFREAKS_API_KEY:
        raise RatesUnavailable("no API key")
    try:
        r = _get("latest")
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, ValueError) as e:
        log.exception("Current exchange rates fetch failed")
        raise RatesUnavailable(str(e)) from e
    _current.update(
        fetched_at=time.time(),
        date=str(data.get("date", ""))[:10],
        rates={k: Decimal(str(v)) for k, v in (data.get("rates") or {}).items()},
    )
    return _current["date"], _current["rates"]


def historical_rates(db: Session, day: date, *, fetch: bool = True) -> Optional[Dict[str, Decimal]]:
    """Rates published for `day`, from the cache or the API; None when unavailable."""
    global _historical_available
    rows = db.query(FxRate.currency, FxRate.usd_rate).filter(FxRate.rate_date == day).all()
    if rows:
        return {c: Decimal(r) for c, r in rows}
    if not fetch or _historical_available is False or not CURRENCYFREAKS_API_KEY:
        return None
    try:
        r = _get("historical", date=day.isoformat())
        if r.status_code in (402, 403):
            _historical_available = False
            log.info("Historical exchange rates are not available on this CurrencyFreaks plan")
            return None
        r.raise_for_status()
        rates = {k: Decimal(str(v)) for k, v in (r.json().get("rates") or {}).items()}
    except (requests.RequestException, ValueError):
        log.exception("Historical exchange rates fetch failed for %s", day)
        return None
    _historical_available = True
    db.add_all(FxRate(rate_date=day, currency=c, usd_rate=v) for c, v in rates.items())
    db.flush()
    return rates


Bucket = Tuple[Optional[date], str, Decimal]


def convert(db: Session, buckets: Iterable[Bucket], to_currency: str) -> Conversion:
    """
    Sum amounts given as (date, currency, amount) into `to_currency`.

    Each bucket uses the rate on its date when historical rates are available, otherwise today's
    rate. Amounts in currencies with no published rate are left out and reported.
    """
    dst = to_currency.strip().upper()
    rate_date, current = current_rates()
    if dst not in current:
        raise ValueError(f"Unknown currency code {dst}")
    total, bases, dates = Decimal(0), set(), set()
    not_converted: Dict[str, Decimal] = {}
    fetches = 0
    for day, cur, amount in buckets:
        cur = (cur or "").upper()
        if cur == dst:
            total += amount
            continue
        rates = None
        if day is not None:
            rates = historical_rates(db, day, fetch=fetches < _MAX_FETCHES_PER_CALL)
            fetches += rates is None
        if rates and cur in rates and dst in rates:
            total += amount * rates[dst] / rates[cur]
            bases.add("historical")
            dates.add(day.isoformat())
        elif cur in current:
            total += amount * current[dst] / current[cur]
            bases.add("current")
            dates.add(rate_date)
        else:
            not_converted[cur or "unknown"] = not_converted.get(cur or "unknown", Decimal(0)) + amount
    basis = "mixed" if len(bases) > 1 else (bases.pop() if bases else "none")
    return Conversion(
        total=_money(total), currency=dst, rate_basis=basis, approximate=basis != "historical",
        rate_dates=sorted(dates), not_converted={c: _money(v) for c, v in not_converted.items()},
    )
