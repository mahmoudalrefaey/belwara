import inspect
import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.services import chat_tools, fx_service

SUMMARY_ARGS = {"start": None, "end": None, "group_by": None, "merchant": None, "merchant_alternatives": None,
                "category": None,
                "currency": None, "convert_to": None, "compare_start": None, "compare_end": None}


def _row(currency="EGP", total="100.00", receipts=2, group=None, **extra):
    row = {"currency": currency, "total": Decimal(total), "receipts": receipts, "missing_total": 0,
           "average": chat_tools.money(Decimal(total) / receipts), "tax": Decimal("0.00"),
           "other_charges": Decimal("0.00"),
           "needs_review": 0, "needs_review_amount": Decimal("0.00"), "verified": 0, **extra}
    return {"group": group, **row} if group is not None else row


def _call(tools, name, **args):
    return json.loads(chat_tools.run_tool(MagicMock(), tools, name, json.dumps(args)))


def test_tool_specs_are_strict_and_match_callables():
    tools = chat_tools.build_tools(MagicMock(), user_id=1)
    assert {s["function"]["name"] for s in chat_tools.TOOL_SPECS} == set(tools)
    for spec in chat_tools.TOOL_SPECS:
        fn = spec["function"]
        params = fn["parameters"]
        assert fn["strict"] is True
        assert params["additionalProperties"] is False
        assert params["required"] == list(params["properties"])
        # The model can only pass the declared args — user_id is never one of them.
        assert "user_id" not in params["properties"]
        assert list(inspect.signature(tools[fn["name"]]).parameters) == params["required"]


def test_tools_are_bound_to_the_given_user(monkeypatch):
    seen = {}

    def fake_summary(db, user_id, **kwargs):
        seen["user_id"] = user_id
        return []

    monkeypatch.setattr(chat_tools.receipt_service, "spending_summary", fake_summary)
    tools = chat_tools.build_tools(MagicMock(), user_id=42)
    assert _call(tools, "spending_summary", **SUMMARY_ARGS)["status"] == "no_results"
    assert seen["user_id"] == 42


def test_errors_are_envelopes_not_exceptions():
    db = MagicMock()
    tools = chat_tools.build_tools(db, user_id=1)
    assert json.loads(chat_tools.run_tool(db, tools, "drop_tables", "{}"))["error"]["code"] == "unknown_tool"
    bad = _call(tools, "spending_summary", **{**SUMMARY_ARGS, "start": "last month"})
    assert bad["status"] == "error" and bad["error"]["code"] == "invalid_arguments"
    backwards = _call(tools, "spending_summary",
                      **{**SUMMARY_ARGS, "start": "2026-05-01", "end": "2026-04-01"})
    assert backwards["error"]["code"] == "invalid_arguments"


def test_run_tool_rolls_back_after_a_failed_query(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("db down")

    monkeypatch.setattr(chat_tools.receipt_service, "list_items", boom)
    db = MagicMock()
    tools = chat_tools.build_tools(db, user_id=1)
    args = json.dumps({"query": None, "query_alternatives": None, "merchant": None,
                       "merchant_alternatives": None, "start": None, "end": None, "mode": "list",
                       "sort": None, "limit": 10})
    out = json.loads(chat_tools.run_tool(db, tools, "find_items", args))
    assert out["status"] == "error" and out["error"]["retryable"] is True
    assert "db down" not in json.dumps(out)  # internals never reach the model
    db.rollback.assert_called_once()


def test_daily_average_is_computed_over_days_in_range(monkeypatch):
    monkeypatch.setattr(chat_tools.receipt_service, "spending_summary",
                        lambda db, uid, **kw: [_row(total="310.00", receipts=4)])
    tools = chat_tools.build_tools(MagicMock(), user_id=1)
    out = _call(tools, "spending_summary", **{**SUMMARY_ARGS, "start": "2026-01-01", "end": "2026-01-31"})
    assert out["period"]["days_counted"] == 31
    assert out["rows"][0]["daily_average"] == "10.00"
    assert out["rows"][0]["average"] == "77.50"  # per receipt, unchanged


def test_daily_average_stops_at_today(monkeypatch):
    monkeypatch.setattr(chat_tools.receipt_service, "spending_summary",
                        lambda db, uid, **kw: [_row(total="100.00")])
    tools = chat_tools.build_tools(MagicMock(), user_id=1)
    start = date.today() - timedelta(days=3)
    out = _call(tools, "spending_summary", **{**SUMMARY_ARGS, "start": start.isoformat(),
                                              "end": (date.today() + timedelta(days=20)).isoformat()})
    assert out["period"]["days_counted"] == 4
    assert out["rows"][0]["daily_average"] == "25.00"


def test_comparison_reports_differences_and_handles_a_zero_base(monkeypatch):
    def fake(db, uid, start=None, **kw):
        if start == date(2026, 9, 1):
            return [_row("EGP", "150.00"), _row("SAR", "40.00", 1)]
        return [_row("EGP", "100.00")]

    monkeypatch.setattr(chat_tools.receipt_service, "spending_summary", fake)
    tools = chat_tools.build_tools(MagicMock(), user_id=1)
    out = _call(tools, "spending_summary", **{**SUMMARY_ARGS, "start": "2026-09-01", "end": "2026-09-30",
                                              "compare_start": "2026-08-01", "compare_end": "2026-08-31"})
    changes = {c["currency"]: c for c in out["comparison"]["changes"]}
    assert changes["EGP"]["difference"] == "50.00" and changes["EGP"]["percent_change"] == "50.00"
    assert changes["SAR"]["compare_period"] == "0.00" and changes["SAR"]["percent_change"] is None


def test_quality_notes_report_missing_totals_and_review(monkeypatch):
    monkeypatch.setattr(chat_tools.receipt_service, "spending_summary", lambda db, uid, **kw: [
        _row(missing_total=2, needs_review=1, needs_review_amount=Decimal("30.00"))])
    out = _call(chat_tools.build_tools(MagicMock(), user_id=1), "spending_summary", **SUMMARY_ARGS)
    text = " ".join(out["limitations"])
    assert "2 receipt(s)" in text and "no total" in text and "30.00 EGP" in text


def test_largest_is_ranked_within_each_currency(monkeypatch):
    monkeypatch.setattr(chat_tools.receipt_service, "account_overview",
                        lambda db, uid: {"currencies": [{"currency": "EGP"}, {"currency": "EUR"}]})
    seen = []

    def fake_list(db, uid, **kw):
        seen.append(kw["currency"])
        r = MagicMock(receipt_id=len(seen), merchant_name="m", receipt_date=None, total_amount=Decimal(9),
                      currency=kw["currency"], total_taxes=Decimal(0), category=None, status="ready",
                      verification="extracted", review_reasons=None)
        return [r], 1

    monkeypatch.setattr(chat_tools.receipt_service, "list_receipts_page", fake_list)
    out = _call(chat_tools.build_tools(MagicMock(), user_id=1), "find_receipts", start=None, end=None,
                merchant=None, merchant_alternatives=None, category=None, currency=None, status=None,
                text=None, sort="largest", limit=3)
    assert set(out["by_currency"]) == {"EGP", "EUR"} and seen == ["EGP", "EUR"]
    assert "not comparable" in out["limitations"][0]


def test_same_currency_conversion_needs_no_api():
    tools = chat_tools.build_tools(MagicMock(), user_id=1)
    out = _call(tools, "convert_currency", amount=10, from_currency="egp", to_currency="EGP")
    assert out == {"status": "ok", "amount": "10.00", "currency": "EGP"}


# ── fx_service ───────────────────────────────────────────────────────────────

@pytest.fixture
def rates(monkeypatch):
    table = {"USD": Decimal(1), "EGP": Decimal(50), "EUR": Decimal("0.5")}
    monkeypatch.setattr(fx_service, "current_rates", lambda: ("2026-10-30", table))
    monkeypatch.setattr(fx_service, "historical_rates", lambda db, day, fetch=True: None)


def test_conversion_without_history_uses_todays_rate_and_says_so(rates):
    buckets = [(date(2025, 1, 1), "EUR", Decimal(10)), (None, "EGP", Decimal(5))]
    c = fx_service.convert(MagicMock(), buckets, "egp")
    assert c.total == Decimal("1005.00") and c.rate_basis == "current" and c.approximate
    assert c.rate_dates == ["2026-10-30"]


def test_conversion_uses_receipt_date_rates_when_available(monkeypatch, rates):
    monkeypatch.setattr(fx_service, "historical_rates",
                        lambda db, day, fetch=True: {"EGP": Decimal(30), "EUR": Decimal(1)})
    c = fx_service.convert(MagicMock(), [(date(2025, 1, 1), "EUR", Decimal(10))], "EGP")
    assert c.total == Decimal("300.00") and c.rate_basis == "historical" and not c.approximate


def test_conversion_leaves_out_unknown_codes(rates):
    c = fx_service.convert(MagicMock(), [(None, "EGY", Decimal(7)), (None, "EUR", Decimal(1))], "EGP")
    assert c.not_converted == {"EGY": Decimal("7.00")} and c.total == Decimal("100.00")


def test_historical_rates_stop_after_the_plan_refuses(monkeypatch):
    monkeypatch.setattr(fx_service, "CURRENCYFREAKS_API_KEY", "k")
    monkeypatch.setattr(fx_service, "_historical_available", None)
    calls = []

    def fake_get(path, **params):
        calls.append(path)
        return MagicMock(status_code=402)

    monkeypatch.setattr(fx_service, "_get", fake_get)
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    assert fx_service.historical_rates(db, date(2025, 1, 1)) is None
    assert fx_service.historical_rates(db, date(2025, 1, 2)) is None
    assert calls == ["historical"]
