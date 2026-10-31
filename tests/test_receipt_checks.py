import io
from datetime import date
from decimal import Decimal

import pytest
from PIL import Image

from app.services.extract_service import (
    ExtractedItem,
    ExtractedReceipt,
    ExtractionError,
    _pages_as_data_urls,
    build_receipt_data,
)

TODAY = date(2026, 10, 29)


def _receipt(**overrides) -> ExtractedReceipt:
    base = dict(
        raw_text="Shop\nTotal 100.00",
        is_receipt=True,
        merchant_name="Carrefour",
        receipt_date="2026-10-20",
        currency="EGP",
        category="groceries",
        items=[
            ExtractedItem(item_name="Milk", quantity=2, unit_price=20.0, line_total=None),
            ExtractedItem(item_name="Bread", quantity=1, unit_price=None, line_total=60.0),
        ],
        subtotal=100.0,
        total_taxes=None,
        tax_rate_percent=None,
        other_charges=None,
        total_amount=100.0,
        amount_paid=None,
        change_due=None,
    )
    base.update(overrides)
    return ExtractedReceipt(**base)


def test_clean_receipt_is_ready_and_fills_prices():
    fields, items, reasons = build_receipt_data(_receipt(), TODAY)
    assert reasons == []
    assert fields["total_amount"] == Decimal("100.0")
    assert fields["receipt_date"].date() == date(2026, 10, 20)
    assert items[0]["line_total"] == Decimal("40.0")
    assert items[1]["unit_price"] == Decimal("60.0")


def test_total_equal_to_paid_becomes_paid_minus_change():
    fields, _, reasons = build_receipt_data(
        _receipt(total_amount=200.0, amount_paid=200.0, change_due=100.0), TODAY
    )
    assert fields["total_amount"] == Decimal("100.0")
    assert reasons == []


def test_missing_total_derived_from_paid_and_change():
    fields, _, _ = build_receipt_data(
        _receipt(total_amount=None, amount_paid=150.0, change_due=50.0), TODAY
    )
    assert fields["total_amount"] == Decimal("100.0")


def test_correct_total_is_kept_when_paid_differs():
    fields, _, _ = build_receipt_data(
        _receipt(total_amount=100.0, amount_paid=200.0, change_due=100.0), TODAY
    )
    assert fields["total_amount"] == Decimal("100.0")


def test_missing_fields_are_flagged():
    _, _, reasons = build_receipt_data(
        _receipt(merchant_name="  ", receipt_date=None, currency=None, total_amount=None), TODAY
    )
    assert {"missing_merchant_name", "missing_receipt_date", "missing_currency",
            "missing_total_amount"} <= set(reasons)


def test_invalid_date_string_is_treated_as_missing():
    fields, _, reasons = build_receipt_data(_receipt(receipt_date="2026-13-45"), TODAY)
    assert fields["receipt_date"] is None
    assert "missing_receipt_date" in reasons


def test_future_and_old_dates_are_flagged():
    assert "date_in_future" in build_receipt_data(_receipt(receipt_date="2026-12-01"), TODAY)[2]
    assert "date_too_old" in build_receipt_data(_receipt(receipt_date="2020-01-01"), TODAY)[2]


def test_items_sum_mismatch_is_flagged():
    _, _, reasons = build_receipt_data(_receipt(subtotal=None, total_amount=500.0), TODAY)
    assert "items_sum_mismatch" in reasons


def test_items_sum_matches_total_minus_tax_and_charges():
    _, _, reasons = build_receipt_data(
        _receipt(subtotal=None, total_taxes=14.0, other_charges=6.0, total_amount=120.0), TODAY
    )
    assert "items_sum_mismatch" not in reasons


def test_vat_rate_distributes_item_taxes():
    _, items, _ = build_receipt_data(_receipt(tax_rate_percent=14.0), TODAY)
    assert items[0]["taxes"] == Decimal("5.6")


def test_blank_items_dropped_and_weights_kept_as_quantity():
    _, items, reasons = build_receipt_data(
        _receipt(subtotal=None, total_amount=100.0, items=[
            ExtractedItem(item_name=" ", quantity=1, unit_price=1.0, line_total=1.0),
            ExtractedItem(item_name="Tomatoes", quantity=0.4, unit_price=None, line_total=100.0),
        ]),
        TODAY,
    )
    assert [i["item_name"] for i in items] == ["Tomatoes"]
    assert items[0]["quantity"] == Decimal("0.4")          # a weight, not rounded to 1
    assert items[0]["unit_price"] == Decimal("250.00")     # price per kg
    assert "line_price_mismatch" not in reasons


def test_missing_quantity_defaults_to_one():
    _, items, _ = build_receipt_data(
        _receipt(items=[ExtractedItem(item_name="Bag", quantity=0, unit_price=5.0, line_total=5.0)]), TODAY
    )
    assert items[0]["quantity"] == Decimal(1)


def test_price_times_quantity_that_misses_the_line_total_is_flagged():
    _, _, reasons = build_receipt_data(
        _receipt(subtotal=None, total_amount=2799.0, items=[
            ExtractedItem(item_name="Laptop", quantity=1, unit_price=799.0, line_total=2799.0),
        ]),
        TODAY,
    )
    assert "line_price_mismatch" in reasons


def test_unsupported_and_corrupt_files_raise():
    with pytest.raises(ExtractionError):
        _pages_as_data_urls(b"x", ".docx")
    with pytest.raises(ExtractionError):
        _pages_as_data_urls(b"not an image", ".jpg")


def test_large_image_is_downscaled_to_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (4000, 1000), "white").save(buf, format="PNG")
    (url,) = _pages_as_data_urls(buf.getvalue(), ".png")
    assert url.startswith("data:image/jpeg;base64,")


def test_corrections_need_a_real_currency_code():
    from pydantic import ValidationError

    from app.schemas.receipt import ReceiptUpdate

    assert ReceiptUpdate(currency=" egp ").currency == "EGP"
    for code in ("TUR", "SUR", "LE"):
        with pytest.raises(ValidationError):
            ReceiptUpdate(currency=code)
