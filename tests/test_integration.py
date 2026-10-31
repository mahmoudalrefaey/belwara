"""
End-to-end tests against a real, disposable Postgres (skipped unless TEST_DATABASE_URL is set).
The model calls are faked; everything else (SQL, storage, background jobs, HTTP) is real.
"""

import io
import json
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"), reason="TEST_DATABASE_URL not set"
)

from alembic import command  # noqa: E402
from alembic.autogenerate import compare_metadata  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic.migration import MigrationContext  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.models import ChatAction, ChatMessage, Receipt, ReceiptItem, User  # noqa: E402
from app.models.usage import LlmUsage  # noqa: E402
from app.services import (  # noqa: E402
    action_service,
    chat_service,
    chat_tools,
    extract_service,
    receipt_service,
    storage_service,
    upload_service,
)
from app.schemas.receipt import ReceiptUpdate  # noqa: E402
from app.services.extract_service import ExtractedItem, ExtractedReceipt  # noqa: E402

TODAY = date.today()


@pytest.fixture(scope="module", autouse=True)
def schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    command.upgrade(Config("alembic.ini"), "head")
    yield


@pytest.fixture(autouse=True)
def clean(tmp_path, monkeypatch):
    monkeypatch.setattr(storage_service, "_LOCAL_DIR", tmp_path)
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE users, receipt, receipt_items, chat_messages, chat_actions, llm_usage "
            "RESTART IDENTITY CASCADE"
        ))
    yield


def _user(db, email):
    u = User(email=email, password_hash="x")
    db.add(u)
    db.commit()
    return u.user_id


def _receipt(db, user_id, merchant, amount, currency="EGP", days_ago=1, category="groceries",
             status="ready", items=(), tax="0"):
    r = Receipt(
        user_id=user_id, status=status, merchant_name=merchant,
        receipt_date=datetime.combine(TODAY - timedelta(days=days_ago), datetime.min.time(),
                                      tzinfo=timezone.utc),
        total_amount=Decimal(str(amount)) if amount is not None else None, currency=currency,
        category=category, total_taxes=Decimal(tax),
        items=[ReceiptItem(item_name=n, quantity=1, unit_price=p, line_total=p) for n, p in items],
    )
    db.add(r)
    db.commit()
    return r.receipt_id


def _extracted(**overrides):
    base = dict(
        raw_text="SHOP\nMilk 40\nTotal 40", is_receipt=True, merchant_name="Metro",
        receipt_date=(TODAY - timedelta(days=2)).isoformat(), currency="EGP", category="groceries",
        items=[ExtractedItem(item_name="Milk", quantity=1, unit_price=40.0, line_total=40.0)],
        subtotal=40.0, total_taxes=None, tax_rate_percent=None, other_charges=None,
        total_amount=40.0, amount_paid=None, change_due=None,
    )
    base.update(overrides)
    return ExtractedReceipt(**base)


def _usage():
    return SimpleNamespace(prompt_tokens=1000, completion_tokens=200, total_tokens=1200)


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (50, 80), "white").save(buf, format="PNG")
    return buf.getvalue()


# ── schema ──────────────────────────────────────────────────────────────────

def test_migration_matches_models():
    with engine.connect() as conn:
        diffs = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diffs == []


# ── aggregates are per user and per currency ────────────────────────────────

def test_spending_summary_is_scoped_and_never_mixes_currencies():
    db = SessionLocal()
    a, b = _user(db, "a@x.com"), _user(db, "b@x.com")
    _receipt(db, a, "Carrefour", 100)
    _receipt(db, a, "Carrefour", 50)
    _receipt(db, a, "Amazon", 20, currency="USD", category="shopping")
    _receipt(db, a, "Pending", 999, status="processing")
    _receipt(db, b, "Carrefour", 7000)

    rows = {r["currency"]: r for r in receipt_service.spending_summary(db, a)}
    assert rows["EGP"]["total"] == 150.0 and rows["EGP"]["receipts"] == 2
    assert rows["EGP"]["average"] == 75.0
    assert rows["USD"]["total"] == 20.0

    by_merchant = receipt_service.spending_summary(db, a, group_by="merchant", currency="EGP")
    assert [(r["group"], r["total"], r["receipts"], r["average"]) for r in by_merchant] == [
        ("Carrefour", Decimal("150.00"), 2, Decimal("75.00"))
    ]
    assert receipt_service.spending_summary(db, b)[0]["total"] == 7000.0
    db.close()


def test_summary_reports_what_it_leaves_out_and_what_needs_review():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    _receipt(db, a, "Shop", 100)
    _receipt(db, a, "Shop", 30, status="needs_review")
    _receipt(db, a, "Shop", None, status="needs_review")  # total unreadable
    _receipt(db, a, "Cafe", 50, tax="7.00")
    [row] = receipt_service.spending_summary(db, a)
    assert row["total"] == Decimal("180.00") and row["receipts"] == 3 and row["missing_total"] == 1
    assert row["average"] == Decimal("60.00")  # 180 / 3 receipts that have a total, not / 4
    assert row["needs_review"] == 2 and row["needs_review_amount"] == Decimal("30.00")
    assert row["tax"] == Decimal("7.00")
    db.close()


def test_receipts_sort_by_date_and_amount_not_upload_order():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    old_big = _receipt(db, a, "Old", 900, days_ago=40)
    _receipt(db, a, "Recent", 10, days_ago=2)
    newest = _receipt(db, a, "Newest", 20, days_ago=1)
    late_upload = _receipt(db, a, "Uploaded last", 5, days_ago=20)
    failed = _receipt(db, a, None, None, status="failed")

    def first(**kw):
        rows, _ = receipt_service.list_receipts_page(db, a, limit=1, offset=0, **kw)
        return rows[0].receipt_id

    counted = ("ready", "needs_review")
    assert first(sort="recently_uploaded") == failed
    assert first(sort="recently_uploaded", statuses=counted) == late_upload
    assert first(sort="newest", statuses=counted) == newest
    assert first(sort="largest", statuses=counted) == old_big
    assert first(sort="oldest", statuses=counted) == old_big
    assert first(statuses=["failed"]) == failed
    db.close()


def test_confirming_a_receipt_marks_it_verified():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    rid = _receipt(db, a, "Shop", 40, status="needs_review")
    r = receipt_service.get_receipt_by_id(db, rid, a)
    assert r.verification == "needs_review"
    r = receipt_service.update_receipt(db, r, ReceiptUpdate())
    assert r.status == "ready" and r.verification == "verified"
    [row] = receipt_service.spending_summary(db, a)
    assert row["verified"] == 1
    db.close()


def test_overview_items_and_conversion_buckets():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    _receipt(db, a, "Shop", 100, items=[("Milk", 40), ("Bread", 60)], days_ago=3)
    _receipt(db, a, "Shop", 50, items=[("Milk", 50)], days_ago=1)
    _receipt(db, a, "Paris", 10, currency="EUR", category="shopping", days_ago=1)
    _receipt(db, a, None, None, status="failed")
    _receipt(db, a, None, 9, status="needs_review")

    o = receipt_service.account_overview(db, a)
    assert o["receipts_by_status"] == {"ready": 3, "failed": 1, "needs_review": 1}
    assert o["latest_receipt_date"].date() == TODAY - timedelta(days=1)
    assert [r.merchant_name for r in o["needs_review"]] == [None]

    [milk] = receipt_service.item_summary(db, a, query="milk")
    assert milk["times"] == 2 and milk["spent"] == Decimal("90.00") and milk["quantity"] == 2
    priciest = receipt_service.list_items(db, a, sort="highest_price", limit=1)
    assert priciest[0]["item_name"] == "Bread"

    buckets = receipt_service.daily_buckets(db, a, group_by="category")
    assert {(g, c) for g, _, c, _, _ in buckets} == {("groceries", "EGP"), ("shopping", "EUR")}
    assert sum(t for g, _, c, t, _ in buckets if c == "EGP") == Decimal("159")
    db.close()


def test_dashboard_and_items():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    _receipt(db, a, "Carrefour", 100, items=[("Milk", 40), ("Bread", 60)])
    _receipt(db, a, "Uber", 30, category="transport", status="needs_review")
    _receipt(db, a, "Amazon", 20, currency="USD")

    d = receipt_service.dashboard(db, a)
    assert d["currency"] == "EGP" and d["total"] == 130.0 and d["receipts"] == 2
    assert {c["label"] for c in d["by_category"]} == {"groceries", "transport"}
    assert d["needs_review"] == 1
    assert receipt_service.dashboard(db, a, "USD")["total"] == 20.0
    assert receipt_service.dashboard(db, a, "XXX")["currency"] == "EGP"  # unknown → fallback

    items = receipt_service.list_items(db, a, query="mil")
    assert [i["item_name"] for i in items] == ["Milk"]
    rows, total = receipt_service.search_receipts(db, "bread", a)
    assert total == 1 and rows[0].merchant_name == "Carrefour"
    db.close()


# ── background extraction pipeline ──────────────────────────────────────────

def _processing_receipt(db, user_id):
    key = storage_service.save(user_id, _png(), ".png")
    r = Receipt(user_id=user_id, status="processing", image_key=key, source_filename="r.png")
    db.add(r)
    db.commit()
    return r.receipt_id


def test_process_receipt_ready_then_duplicate(monkeypatch):
    monkeypatch.setattr(extract_service, "extract_receipt", lambda data, ext: (_extracted(), _usage()))
    db = SessionLocal()
    a = _user(db, "a@x.com")
    first, second = _processing_receipt(db, a), _processing_receipt(db, a)
    upload_service.process_receipt(first)
    upload_service.process_receipt(second)

    db.expire_all()
    r1, r2 = db.get(Receipt, first), db.get(Receipt, second)
    assert r1.status == "ready" and r1.review_reasons is None
    assert r1.total_amount == Decimal("40.00") and len(r1.items) == 1
    assert r2.status == "needs_review" and r2.review_reasons == ["possible_duplicate"]
    assert db.query(LlmUsage).count() == 2
    db.close()


def test_process_receipt_failures(monkeypatch):
    db = SessionLocal()
    a = _user(db, "a@x.com")

    monkeypatch.setattr(extract_service, "extract_receipt",
                        lambda d, e: (_extracted(is_receipt=False), _usage()))
    not_receipt = _processing_receipt(db, a)
    upload_service.process_receipt(not_receipt)

    def boom(d, e):
        raise RuntimeError("azure down")

    monkeypatch.setattr(extract_service, "extract_receipt", boom)
    crashed = _processing_receipt(db, a)
    upload_service.process_receipt(crashed)

    db.expire_all()
    assert db.get(Receipt, not_receipt).review_reasons == ["not_a_receipt"]
    assert db.get(Receipt, crashed).status == "failed"
    assert db.get(Receipt, crashed).review_reasons == ["processing_error"]
    db.close()


def test_stale_processing_receipts_are_claimed_once():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    stale, fresh = _processing_receipt(db, a), _processing_receipt(db, a)
    db.execute(text("UPDATE receipt SET updated_at = now() - interval '1 hour' WHERE receipt_id = :i"),
               {"i": stale})
    db.commit()
    db.close()
    assert upload_service.claim_stale_receipts() == [stale]
    assert upload_service.claim_stale_receipts() == []
    assert fresh not in upload_service.claim_stale_receipts()


# ── HTTP: upload → review → correct, plus chat with a faked model ───────────

def _auth(client, email="a@x.com"):
    client.post("/users/register", json={"email": email, "password": "password123"})
    token = client.post("/users/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}


def test_upload_review_and_correct_flow(monkeypatch):
    monkeypatch.setattr(extract_service, "extract_receipt",
                        lambda d, e: (_extracted(currency=None), _usage()))
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        res = client.post("/receipts/upload", headers=h,
                          files=[("files", ("r.png", _png(), "image/png"))])
        assert res.status_code == 202
        rid = res.json()["receipts"][0]["receipt_id"]

        r = client.get(f"/receipts/{rid}", headers=h).json()  # background task already ran
        assert r["status"] == "needs_review" and r["review_reasons"] == ["missing_currency"]
        assert client.get(f"/receipts/{rid}/image", headers=h).content == _png()

        patched = client.patch(f"/receipts/{rid}", headers=h, json={"currency": "EGP"})
        assert patched.json()["status"] == "ready"
        assert client.get("/receipts/dashboard", headers=h).json()["total"] == 40.0

        other = _auth(client, "b@x.com")
        assert client.get(f"/receipts/{rid}", headers=other).status_code == 404
        assert client.get(f"/receipts/{rid}/image", headers=other).status_code == 404

        bad = client.post("/receipts/upload", headers=h, files=[("files", ("a.docx", b"x", "x"))])
        assert bad.status_code == 400

        assert client.delete(f"/receipts/{rid}", headers=h).status_code == 200
        assert list(storage_service._LOCAL_DIR.rglob("*.png")) == []


def _completion(message, finish_reason="stop"):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=message, finish_reason=finish_reason)], usage=_usage()
    )


def test_chat_tool_loop_uses_server_numbers_and_persists_history(monkeypatch):
    calls = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            args = {"start": None, "end": None, "group_by": None, "merchant": None,
                    "merchant_alternatives": None, "category": None,
                    "currency": None, "convert_to": None, "compare_start": None, "compare_end": None}
            call = SimpleNamespace(id="c1", function=SimpleNamespace(
                name="spending_summary", arguments=json.dumps(args)))
            return _completion(SimpleNamespace(content=None, tool_calls=[call]), "tool_calls")
        tool_result = json.loads(kwargs["messages"][-1]["content"])
        return _completion(SimpleNamespace(
            content=f"You spent {tool_result['rows'][0]['total']} EGP.", tool_calls=None))

    monkeypatch.setattr(chat_service.client.chat.completions, "create", fake_create)
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        db = SessionLocal()
        uid = db.query(User.user_id).filter(User.email == "a@x.com").scalar()
        _receipt(db, uid, "Carrefour", 123.45)
        other = _user(db, "b@x.com")
        _receipt(db, other, "Carrefour", 9999)
        db.close()

        body = client.post("/chat", headers=h, json={"message": "How much did I spend?"}).json()
        assert body["reply"] == "You spent 123.45 EGP."
        history = client.get(f"/chat/threads/{body['thread_id']}", headers=h).json()
        assert [m["role"] for m in history] == ["user", "assistant"]
        assert client.get("/chat/threads", headers=h).json()[0]["title"] == "How much did I spend?"


def test_deleting_a_chat_hides_it_but_still_counts_toward_the_quota(monkeypatch):
    monkeypatch.setattr(
        chat_service.client.chat.completions, "create",
        lambda **kw: _completion(SimpleNamespace(content="Hi!", tool_calls=None)),
    )
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        other = _auth(client, "b@x.com")
        thread = client.post("/chat", headers=h, json={"message": "my secret"}).json()["thread_id"]
        keep = client.post("/chat", headers=h, json={"message": "keep me"}).json()["thread_id"]

        # Nobody else can delete it, and a missing thread is a 404.
        assert client.delete(f"/chat/threads/{thread}", headers=other).status_code == 404
        assert client.delete("/chat/threads/nope", headers=h).status_code == 404

        assert client.delete(f"/chat/threads/{thread}", headers=h).status_code == 204
        assert client.get(f"/chat/threads/{thread}", headers=h).status_code == 404
        assert [t["thread_id"] for t in client.get("/chat/threads", headers=h).json()] == [keep]
        assert "my secret" not in client.get("/users/me/export", headers=h).text
        # Deleting doesn't refund the question.
        assert client.get("/users/me/usage", headers=h).json()["chat"]["used"] == 2

        db = SessionLocal()
        leftovers = db.query(ChatMessage).filter(ChatMessage.thread_id == thread).all()
        assert [(m.role, m.content) for m in leftovers] == [("user", "")]
        db.close()


# ── plans, quotas, export and account deletion ──────────────────────────────

def test_quota_blocks_uploads_and_chat(monkeypatch):
    from app.services import quota_service

    monkeypatch.setitem(quota_service.PLAN_LIMITS, "free", {"receipts": 1, "chat": 0})
    monkeypatch.setattr(extract_service, "extract_receipt", lambda d, e: (_extracted(), _usage()))
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        files = [("files", ("r.png", _png(), "image/png"))]
        assert client.post("/receipts/upload", headers=h, files=files).status_code == 202
        blocked = client.post("/receipts/upload", headers=h, files=files)
        assert blocked.status_code == 402 and blocked.json()["detail"]["limit"] == 1
        usage = client.get("/users/me/usage", headers=h).json()
        assert usage == {"plan": "free", "receipts": {"used": 1, "limit": 1},
                         "chat": {"used": 0, "limit": 0}}


def test_export_and_delete_account(monkeypatch):
    monkeypatch.setattr(extract_service, "extract_receipt", lambda d, e: (_extracted(), _usage()))
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        client.post("/receipts/upload", headers=h, files=[("files", ("r.png", _png(), "image/png"))])
        export = client.get("/users/me/export", headers=h)
        assert "attachment" in export.headers["content-disposition"]
        assert export.json()["receipts"][0]["merchant_name"] == "Metro"

        assert client.request("DELETE", "/users/me", headers=h,
                              json={"password": "wrong"}).status_code == 403
        assert client.request("DELETE", "/users/me", headers=h,
                              json={"password": "password123"}).status_code == 200

    db = SessionLocal()
    assert db.query(Receipt).count() == 0 and db.query(LlmUsage).count() == 0
    db.close()
    assert list(storage_service._LOCAL_DIR.rglob("*.png")) == []


# ── chat tools with name matching ───────────────────────────────────────────

def _tool(user_id, name, **args):
    db = SessionLocal()
    try:
        tools = chat_tools.build_tools(db, user_id)
        return json.loads(chat_tools.run_tool(db, tools, name, json.dumps(args)))
    finally:
        db.close()


SUMMARY = {"start": None, "end": None, "group_by": None, "merchant": None, "merchant_alternatives": None,
           "category": None, "currency": None, "convert_to": None, "compare_start": None,
           "compare_end": None}


def test_ocr_spellings_of_one_merchant_are_found_and_kept_as_stored():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    _receipt(db, a, "حواوشي علاء", 100, category="dining")
    _receipt(db, a, "حواوشى فلاء", 50, category="dining")   # OCR damage on the same shop
    _receipt(db, a, "حلواني علاء", 999, category="dining")  # a different shop
    db.close()

    out = _tool(a, "spending_summary", **{**SUMMARY, "merchant": "حواوشي علاء"})
    assert out["status"] == "ok" and out["rows"][0]["total"] == "150.00"
    assert out["match"]["matched"][0]["also_stored_as"] == ["حواوشى فلاء"]

    by = _tool(a, "spending_summary", **{**SUMMARY, "group_by": "merchant"})
    assert len(by["rows"]) == 2  # the two spellings are one row; the other shop stays separate
    [shop] = [r for r in by["rows"] if r["total"] == "150.00"]
    assert {shop["group"], *shop["also_stored_as"]} == {"حواوشي علاء", "حواوشى فلاء"}

    db = SessionLocal()
    stored = sorted(n for (n,) in db.query(Receipt.merchant_name))
    assert stored == ["حلواني علاء", "حواوشى فلاء", "حواوشي علاء"]  # nothing rewritten
    db.close()


def test_a_shared_word_is_ambiguous_with_separate_figures():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    _receipt(db, a, "كبدة علاء", 40)
    _receipt(db, a, "حلواني علاء", 60)
    db.close()
    out = _tool(a, "spending_summary", **{**SUMMARY, "merchant": "علاء"})
    assert out["status"] == "ambiguous"
    assert {c["merchant"]: c["rows"][0]["total"] for c in out["candidates"]} == {
        "كبدة علاء": "40.00", "حلواني علاء": "60.00"}
    assert "rows" not in out  # never one merged figure


def test_unknown_merchant_says_what_was_searched_and_items_use_alternatives():
    db = SessionLocal()
    a = _user(db, "a@x.com")
    _receipt(db, a, "Seoudi Market", 80, items=[("لبن جهينة", 30), ("لبنة", 50)])
    db.close()
    out = _tool(a, "find_receipts", start=None, end=None, merchant="Spinneys", merchant_alternatives=None,
                category=None, currency=None, status=None, text=None, sort=None, limit=5)
    assert out["status"] == "no_results" and out["searched"]["merchant"] == "Spinneys"

    items = {"query": "milk", "query_alternatives": None, "merchant": None, "merchant_alternatives": None,
             "start": None, "end": None, "mode": "summary", "sort": None, "limit": 10}
    assert _tool(a, "find_items", **items)["status"] == "no_results"
    out = _tool(a, "find_items", **{**items, "query_alternatives": ["لبن", "حليب"]})
    assert [i["item"] for i in out["items"]] == ["لبن جهينة"]  # labneh is not milk


def test_migration_flags_codes_that_are_not_currencies_and_keeps_them():
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "003_confirmed_at_fx_rates")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO users (user_id, email, password_hash) VALUES (1, 'm@x.com', 'x')"))
        conn.execute(text(
            # The ORM writes an empty review_reasons as JSON null, not SQL NULL; both must work.
            "INSERT INTO receipt (user_id, status, currency, total_amount, total_taxes, other, "
            "review_reasons) VALUES (1, 'ready', 'TUR', 8, 0, 0, 'null'), "
            "(1, 'ready', 'EGP', 9, 0, 0, NULL), "
            "(1, 'needs_review', 'SUR', 8, 0, 0, '[\"date_too_old\"]'), "
            "(1, 'failed', 'XYZ', NULL, 0, 0, NULL)"
        ))
    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT currency, status, review_reasons FROM receipt ORDER BY currency")).all()
    assert [(c, s, r) for c, s, r in rows] == [
        ("EGP", "ready", None),
        ("SUR", "needs_review", ["date_too_old", "invalid_currency"]),
        ("TUR", "needs_review", ["invalid_currency"]),  # flagged, value kept as stored
        ("XYZ", "failed", None),                        # unreadable uploads are left alone
    ]


def test_receipt_cards_are_scoped_saved_and_noted_for_follow_ups(monkeypatch):
    calls = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            call = SimpleNamespace(id="c1", function=SimpleNamespace(
                name="show_receipts", arguments=json.dumps({"receipt_ids": [mine, theirs]})))
            return _completion(SimpleNamespace(content=None, tool_calls=[call]), "tool_calls")
        return _completion(SimpleNamespace(content="Here it is.", tool_calls=None))

    monkeypatch.setattr(chat_service.client.chat.completions, "create", fake_create)
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        db = SessionLocal()
        uid = db.query(User.user_id).filter(User.email == "a@x.com").scalar()
        mine = _receipt(db, uid, "Carrefour", 123.45)
        theirs = _receipt(db, _user(db, "b@x.com"), "Secret Shop", 9999)
        db.close()

        body = client.post("/chat", headers=h, json={"message": "Show my receipt"}).json()
        assert [c["receipt_id"] for c in body["receipts"]] == [mine]  # another user's id is dropped
        assert body["receipts"][0]["total"] == "123.45"
        history = client.get(f"/chat/threads/{body['thread_id']}", headers=h).json()
        assert history[1]["receipts"][0]["merchant"] == "Carrefour"

        calls.clear()
        client.post("/chat", headers=h, json={"message": "and that one?", "thread_id": body["thread_id"]})
        notes = [m["content"] for m in calls[0]["messages"] if m["role"] == "system"]
        assert any(f"#{mine} Carrefour" in n for n in notes)
        assert "Secret Shop" not in json.dumps(calls[0]["messages"], ensure_ascii=False)


# ── confirmed actions ───────────────────────────────────────────────────────

def _propose(user_id, kind, receipt_id, category=None):
    db = SessionLocal()
    try:
        tools = chat_tools.build_tools(db, user_id, actions=[])
        out = json.loads(chat_tools.run_tool(db, tools, "propose_action", json.dumps(
            {"kind": kind, "receipt_id": receipt_id, "category": category})))
        db.commit()
        return out
    finally:
        db.close()


def _get(receipt_id, user_id):
    db = SessionLocal()
    try:
        return receipt_service.get_receipt_by_id(db, receipt_id, user_id)
    finally:
        db.close()


def test_proposing_changes_nothing_and_confirming_applies_once(monkeypatch):
    from app.main import app

    executed = []
    real = action_service._execute

    def counting(db, a, r):
        executed.append(a.action_id)
        return real(db, a, r)

    monkeypatch.setattr(action_service, "_execute", counting)
    with TestClient(app) as client:
        h = _auth(client)
        db = SessionLocal()
        uid = db.query(User.user_id).filter(User.email == "a@x.com").scalar()
        rid = _receipt(db, uid, "Uber", 30, category="groceries", status="needs_review")
        db.close()

        p = _propose(uid, "set_category", rid, "transport")
        assert p["status"] == "pending_confirmation"
        assert _get(rid, uid).category == "groceries"  # nothing changed yet

        first = client.post(f"/chat/actions/{p['action_id']}/confirm", headers=h)
        again = client.post(f"/chat/actions/{p['action_id']}/confirm", headers=h)
        assert first.status_code == again.status_code == 200
        assert first.json()["status"] == again.json()["status"] == "done"
        assert executed == [p["action_id"]]  # the repeat changed nothing
        r = _get(rid, uid)
        assert r.category == "transport" and r.status == "needs_review"  # the category, nothing else

        other = _auth(client, "b@x.com")
        assert client.post(f"/chat/actions/{p['action_id']}/confirm", headers=other).status_code == 404
        assert client.post(f"/chat/actions/{p['action_id']}/cancel", headers=h).status_code == 409


def test_simultaneous_confirms_execute_once(monkeypatch):
    import threading
    import time as clock

    executed = []
    real = action_service._execute

    def slow(db, a, r):
        executed.append(a.action_id)
        clock.sleep(0.3)  # hold the lock while the other request arrives
        return real(db, a, r)

    monkeypatch.setattr(action_service, "_execute", slow)
    db = SessionLocal()
    uid = _user(db, "a@x.com")
    rid = _receipt(db, uid, "Shop", 10)
    db.close()
    p = _propose(uid, "delete_receipt", rid)
    statuses = []

    def go():
        s = SessionLocal()
        try:
            statuses.append(action_service.confirm(s, uid, p["action_id"]).status)
        finally:
            s.close()

    threads = [threading.Thread(target=go) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert statuses == ["done", "done"] and len(executed) == 1
    assert _get(rid, uid) is None


def test_expired_stale_failed_and_cancelled_changes_do_nothing(monkeypatch):
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        db = SessionLocal()
        uid = db.query(User.user_id).filter(User.email == "a@x.com").scalar()
        rid = _receipt(db, uid, "Shop", 10, category="groceries")
        db.close()

        expired = _propose(uid, "set_category", rid, "dining")
        db = SessionLocal()
        db.query(ChatAction).filter(ChatAction.action_id == expired["action_id"]).update(
            {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)})
        db.commit()
        db.close()
        r = client.post(f"/chat/actions/{expired['action_id']}/confirm", headers=h)
        assert r.status_code == 410 and r.json()["detail"]["status"] == "expired"

        stale = _propose(uid, "set_category", rid, "dining")
        assert client.patch(f"/receipts/{rid}", headers=h, json={"total_amount": 11}).status_code == 200
        r = client.post(f"/chat/actions/{stale['action_id']}/confirm", headers=h)
        assert r.status_code == 409 and r.json()["detail"]["status"] == "stale"

        def boom(db, a, r):
            r.category = "dining"
            raise RuntimeError("disk full")

        monkeypatch.setattr(action_service, "_execute", boom)
        broken = _propose(uid, "set_category", rid, "dining")
        r = client.post(f"/chat/actions/{broken['action_id']}/confirm", headers=h)
        assert r.status_code == 409 and r.json()["detail"]["status"] == "failed"
        assert "disk full" not in r.text
        assert _get(rid, uid).category == "groceries"  # the half-applied change was rolled back
        monkeypatch.undo()

        cancelled = _propose(uid, "delete_receipt", rid)
        out = client.post(f"/chat/actions/{cancelled['action_id']}/cancel", headers=h).json()
        assert out["status"] == "cancelled"
        assert client.post(f"/chat/actions/{cancelled['action_id']}/confirm", headers=h).status_code == 409
        assert _get(rid, uid) is not None


def test_proposals_check_preconditions_and_replace_older_ones():
    db = SessionLocal()
    uid = _user(db, "a@x.com")
    unreadable = _receipt(db, uid, None, 9, status="needs_review")
    rid = _receipt(db, uid, "Shop", 10, category="groceries")
    other = _receipt(db, _user(db, "b@x.com"), "Theirs", 5)
    db.close()
    assert _propose(uid, "mark_reviewed", unreadable)["status"] == "not_possible"  # no merchant yet
    assert _propose(uid, "set_category", rid, "groceries")["status"] == "no_change"
    assert _propose(uid, "delete_receipt", other)["status"] == "no_results"  # not this user's
    first = _propose(uid, "set_category", rid, "dining")
    second = _propose(uid, "set_category", rid, "shopping")
    db = SessionLocal()
    statuses = dict(db.query(ChatAction.action_id, ChatAction.status))
    db.close()
    assert statuses[first["action_id"]] == "cancelled" and statuses[second["action_id"]] == "pending"


def test_chat_shows_pending_actions_and_remembers_what_happened(monkeypatch):
    calls = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            args = json.dumps({"kind": "delete_receipt", "receipt_id": rid, "category": None})
            call = SimpleNamespace(id="c1", function=SimpleNamespace(name="propose_action", arguments=args))
            return _completion(SimpleNamespace(content=None, tool_calls=[call]), "tool_calls")
        return _completion(SimpleNamespace(content="Tap Confirm to delete it.", tool_calls=None))

    monkeypatch.setattr(chat_service.client.chat.completions, "create", fake_create)
    from app.main import app

    with TestClient(app) as client:
        h = _auth(client)
        db = SessionLocal()
        uid = db.query(User.user_id).filter(User.email == "a@x.com").scalar()
        key = storage_service.save(uid, _png(), ".png")
        r = Receipt(user_id=uid, status="ready", merchant_name="Shop", total_amount=Decimal(10),
                    currency="EGP", image_key=key)
        db.add(r)
        db.commit()
        rid = r.receipt_id
        db.close()

        body = client.post("/chat", headers=h, json={"message": "delete my Shop receipt"}).json()
        [action] = body["actions"]
        assert action["status"] == "pending" and action["kind"] == "delete_receipt"
        assert _get(rid, uid) is not None
        done = client.post(f"/chat/actions/{action['action_id']}/confirm", headers=h).json()
        assert done["status"] == "done"
        assert _get(rid, uid) is None
        with pytest.raises(FileNotFoundError):
            storage_service.load(key)  # the photo went with it

        thread = client.get(f"/chat/threads/{body['thread_id']}", headers=h).json()
        assert thread[1]["actions"][0]["status"] == "done"
        calls.clear()
        client.post("/chat", headers=h, json={"message": "did it work?", "thread_id": body["thread_id"]})
        notes = " ".join(m["content"] for m in calls[0]["messages"] if m["role"] == "system")
        assert f"receipt #{rid}" in notes and "done — the user confirmed it" in notes

        assert client.delete(f"/chat/threads/{body['thread_id']}", headers=h).status_code == 204
        db = SessionLocal()
        assert db.query(ChatAction).count() == 0
        db.close()
