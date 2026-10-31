"""
Receipt extraction: one vision call returns typed fields, then deterministic checks.

extract_receipt()     — prepares the image/PDF pages and calls the model.
build_receipt_data()  — pure function: cleans the model output and decides review reasons.
"""

import base64
import io
import math
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import List, Literal, Optional, Tuple

import fitz
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from app.config import MAX_PDF_PAGES, RECEIPT_DEPLOYMENT
from app.core.llm import client

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | {".pdf"}
_MAX_SIDE_PX = 2048

Currency = Literal[
    "EGP", "USD", "EUR", "GBP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR", "JOD", "INR"
]
Category = Literal[
    "groceries", "dining", "transport", "shopping", "bills", "health", "entertainment", "other"
]


class ExtractionError(ValueError):
    """The file cannot be extracted (unsupported, unreadable, too many pages, filtered)."""


# Field order matters: the model transcribes raw_text first, then reads fields from it.
class ExtractedItem(BaseModel):
    item_name: str
    quantity: float
    unit_price: Optional[float]
    line_total: Optional[float]


class ExtractedReceipt(BaseModel):
    raw_text: str = Field(description="All visible text in reading order, one line per printed line.")
    is_receipt: bool = Field(description="False if the image is not a receipt or invoice.")
    merchant_name: Optional[str]
    receipt_date: Optional[str] = Field(description="YYYY-MM-DD, or null if not printed.")
    currency: Optional[Currency]
    category: Category
    items: List[ExtractedItem]
    subtotal: Optional[float]
    total_taxes: Optional[float]
    tax_rate_percent: Optional[float]
    other_charges: Optional[float] = Field(description="Tips, service charge, delivery fees. Not tax.")
    total_amount: Optional[float] = Field(description="Final amount due after tax and charges.")
    amount_paid: Optional[float] = Field(description="Cash/card tendered, if printed.")
    change_due: Optional[float] = Field(description="Change returned, if printed.")


SYSTEM_PROMPT = """\
You extract data from photos and scans of purchase receipts (Arabic, English, or mixed).
First transcribe all visible text into raw_text. Then fill every field from what is printed.

Rules:
- Use only what is printed. Unknown values are null. Never guess amounts.
- total_amount is the final amount due (الإجمالي / الاجمالي / المجموع / المطلوب / Total / Grand Total).
  Amounts on paid or change lines (المدفوع، الباقي، المتبقي، الفكة، Cash, Paid, Tendered, Change, Balance)
  go to amount_paid / change_due, never to total_amount or other_charges.
- items are purchased products or services only. Do not list subtotal, tax/VAT, service, delivery,
  discount, total, payment, or thank-you lines as items.
- When an item shows one price and quantity > 1, decide whether it is a unit or line price so that
  the sum of line_total matches the subtotal (or the total when there is no subtotal).
- quantity: the printed count, or for items sold by weight the printed weight (e.g. 1.5 for
  "1.5 kg" or "1.5X"). Keep the weight out of item_name. unit_price is then the price per kg/unit,
  and line_total the amount charged for the line.
- other_charges: tips, service charge, delivery fees only.
- Numbers: Western digits (convert ٠١٢٣٤٥٦٧٨٩), no thousands separators.
- receipt_date: YYYY-MM-DD. Arabic and Egyptian receipts write day/month/year.
- currency: ISO code from symbols or words (ج.م / جنيه / LE / EGP → EGP, ر.س / ريال → SAR,
  د.إ / درهم → AED, $ → USD, € → EUR, £ → GBP). Null if nothing indicates it.
- category: the best fit for the merchant.
"""


# ═════════════════════════════════════════════════════════════════════════════
#  IMAGE PREPARATION
# ═════════════════════════════════════════════════════════════════════════════

def _image_to_data_url(img: Image.Image) -> str:
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((_MAX_SIDE_PX, _MAX_SIDE_PX))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _pages_as_data_urls(data: bytes, ext: str) -> List[str]:
    ext = ext.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ExtractionError(f"Unsupported file type '{ext}'.")
    try:
        if ext != ".pdf":
            return [_image_to_data_url(Image.open(io.BytesIO(data)))]
        with fitz.open(stream=data, filetype="pdf") as doc:
            if len(doc) > MAX_PDF_PAGES:
                raise ExtractionError(
                    f"PDF has {len(doc)} pages; maximum allowed is {MAX_PDF_PAGES}."
                )
            return [
                _image_to_data_url(Image.open(io.BytesIO(page.get_pixmap(dpi=200).tobytes("png"))))
                for page in doc
            ]
    except ExtractionError:
        raise
    except Exception as e:  # corrupt or non-image bytes
        raise ExtractionError("File could not be read as an image or PDF.") from e


# ═════════════════════════════════════════════════════════════════════════════
#  MODEL CALL
# ═════════════════════════════════════════════════════════════════════════════

def extract_receipt(data: bytes, ext: str) -> Tuple[ExtractedReceipt, object]:
    """Return (extracted receipt, response.usage). Raises ExtractionError on bad input."""
    content = [{"type": "text", "text": "Extract this receipt."}] + [
        {"type": "image_url", "image_url": {"url": url, "detail": "high"}}
        for url in _pages_as_data_urls(data, ext)
    ]
    response = client.chat.completions.parse(
        model=RECEIPT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        response_format=ExtractedReceipt,
    )
    choice = response.choices[0]
    if choice.finish_reason == "content_filter":
        raise ExtractionError("The file was blocked by the content filter.")
    if choice.message.parsed is None:
        raise ExtractionError("The model did not return receipt data.")
    return choice.message.parsed, response.usage


# ═════════════════════════════════════════════════════════════════════════════
#  DETERMINISTIC CHECKS
# ═════════════════════════════════════════════════════════════════════════════

def _money(value: Optional[float]) -> Optional[Decimal]:
    if value is None:
        return None
    return Decimal(str(round(value, 2)))


def _close(a: float, b: float) -> bool:
    """Within 2% (or 0.05 for tiny amounts) — tolerates rounding on the slip."""
    return math.isclose(a, b, rel_tol=0.02, abs_tol=0.05)


def _parse_date(value: Optional[str]) -> Optional[date]:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def build_receipt_data(ex: ExtractedReceipt, today: date) -> Tuple[dict, List[dict], List[str]]:
    """
    Clean the model output into DB-ready values.
    Returns (receipt_fields, items, review_reasons); empty reasons means the receipt is ready.
    """
    reasons: List[str] = []

    # Paid/change guard: a total equal to the tendered amount is really paid − change.
    total = ex.total_amount
    paid, change = ex.amount_paid, ex.change_due
    if paid is not None and change and change > 0:
        if total is None or _close(total, paid):
            total = round(paid - change, 2)

    items: List[dict] = []
    line_mismatch = False
    for it in ex.items:
        name = it.item_name.strip()[:150]
        if not name:
            continue
        qty = Decimal(str(round(it.quantity, 3))) if it.quantity and it.quantity > 0 else Decimal(1)
        unit, line = it.unit_price, it.line_total
        if line is None and unit is not None:
            line = unit * float(qty)
        if unit is None and line is not None:
            unit = line / float(qty)
        elif unit is not None and line is not None and not _close(unit * float(qty), line):
            line_mismatch = True
        items.append({
            "item_name": name,
            "quantity": qty,
            "unit_price": _money(unit or 0.0),
            "line_total": _money(line or 0.0),
            "taxes": Decimal("0"),
        })

    rate = ex.tax_rate_percent
    if rate and 0 < rate < 100:
        for item in items:
            item["taxes"] = _money(float(item["line_total"]) * rate / 100)

    receipt_date = _parse_date(ex.receipt_date)
    merchant = (ex.merchant_name or "").strip()[:150] or None

    for field, value in (
        ("merchant_name", merchant),
        ("receipt_date", receipt_date),
        ("total_amount", total),
        ("currency", ex.currency),
    ):
        if value is None:
            reasons.append(f"missing_{field}")

    if total is not None and total <= 0:
        reasons.append("invalid_total")

    if receipt_date is not None:
        if receipt_date > today + timedelta(days=1):
            reasons.append("date_in_future")
        elif receipt_date < today - timedelta(days=2 * 365):
            reasons.append("date_too_old")

    if line_mismatch:
        reasons.append("line_price_mismatch")

    if items and total is not None:
        items_sum = sum(float(i["line_total"]) for i in items)
        candidates = [total, total - (ex.total_taxes or 0) - (ex.other_charges or 0)]
        if ex.subtotal is not None:
            candidates.append(ex.subtotal)
        if not any(_close(items_sum, c) for c in candidates):
            reasons.append("items_sum_mismatch")

    fields = {
        "merchant_name": merchant,
        "receipt_date": (
            datetime.combine(receipt_date, time(), tzinfo=timezone.utc) if receipt_date else None
        ),
        "total_amount": _money(total),
        "total_taxes": _money(ex.total_taxes) or Decimal("0"),
        "other": _money(ex.other_charges) or Decimal("0"),
        "currency": ex.currency,
        "category": ex.category,
        "raw_text": ex.raw_text,
    }
    return fields, items, reasons
