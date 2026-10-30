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
from app.models import ChatMessage, Receipt, ReceiptItem, User  # noqa: E402
from app.models.usage import LlmUsage  # noqa: E402
from app.services import (  # noqa: E402
    chat_service,
    extract_service,
    receipt_service,
    storage_service,
    upload_service,
)
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
            "TRUNCATE users, receipt, receipt_items, chat_messages, llm_usage RESTART IDENTITY CASCADE"
        ))
    yield


def _user(db, email):
    u = User(email=email, password_hash="x")
    db.add(u)
    db.commit()
    return u.user_id


def _receipt(db, user_id, merchant, amount, currency="EGP", days_ago=1, category="groceries",
             status="ready", items=()):
    r = Receipt(
        user_id=user_id, status=status, merchant_name=merchant,
        receipt_date=datetime.combine(TODAY - timedelta(days=days_ago), datetime.min.time(),
                                      tzinfo=timezone.utc),
        total_amount=Decimal(str(amount)), currency=currency, category=category,
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
    assert by_merchant == [
        {"group": "Carrefour", "currency": "EGP", "total": 150.0, "receipts": 2, "average": 75.0}
    ]
    assert receipt_service.spending_summary(db, b)[0]["total"] == 7000.0
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
            args = {"start": None, "end": None, "group_by": None, "merchant": None, "category": None}
            call = SimpleNamespace(id="c1", function=SimpleNamespace(
                name="spending_summary", arguments=json.dumps(args)))
            return _completion(SimpleNamespace(content=None, tool_calls=[call]), "tool_calls")
        tool_result = json.loads(kwargs["messages"][-1]["content"])
        return _completion(SimpleNamespace(
            content=f"You spent {tool_result[0]['total']:.2f} EGP.", tool_calls=None))

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
