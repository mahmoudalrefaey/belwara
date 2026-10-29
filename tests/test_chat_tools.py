import inspect
import json
from unittest.mock import MagicMock

from app.services import chat_tools


def test_tool_specs_are_strict_and_match_callables():
    tools = chat_tools.build_tools(MagicMock(), user_id=1)
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
    args = json.dumps({"start": None, "end": None, "group_by": None, "merchant": None, "category": None})
    chat_tools.run_tool(MagicMock(), tools, "spending_summary", args)
    assert seen["user_id"] == 42


def test_run_tool_returns_errors_instead_of_raising():
    db = MagicMock()
    tools = chat_tools.build_tools(db, user_id=1)
    assert "error" in json.loads(chat_tools.run_tool(db, tools, "drop_tables", "{}"))
    bad_date = json.dumps({"start": "last month", "end": None, "group_by": None,
                           "merchant": None, "category": None})
    assert "error" in json.loads(chat_tools.run_tool(db, tools, "spending_summary", bad_date))


def test_run_tool_rolls_back_after_a_failed_query(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("db down")

    monkeypatch.setattr(chat_tools.receipt_service, "list_items", boom)
    db = MagicMock()
    tools = chat_tools.build_tools(db, user_id=1)
    args = json.dumps({"query": None, "merchant": None, "start": None, "end": None, "limit": 10})
    assert "error" in json.loads(chat_tools.run_tool(db, tools, "list_items", args))
    db.rollback.assert_called_once()


def test_same_currency_conversion_needs_no_api():
    assert chat_tools.convert_currency(10, "egp", "EGP") == {"amount": 10, "currency": "EGP"}
