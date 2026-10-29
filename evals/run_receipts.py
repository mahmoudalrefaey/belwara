"""
Receipt extraction accuracy.

Put receipt files in evals/receipts/ and expected values in evals/receipts/expected.json
(format: evals/expected.example.json). Only the keys you give for a file are checked.

    uv run python -m evals.run_receipts            # all files
    uv run python -m evals.run_receipts --only a.jpg

Results are saved to evals/results/ so you can compare a prompt/model change to a baseline.
"""

import argparse
import json
import math
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from app.services.extract_service import build_receipt_data, extract_receipt

ROOT = Path(__file__).parent
RECEIPTS = ROOT / "receipts"
RESULTS = ROOT / "results"


def _check(field: str, expected, fields: dict, items: list) -> bool:
    if field == "merchant_name":
        got = (fields["merchant_name"] or "").lower()
        return bool(got) and (expected.lower() in got or got in expected.lower())
    if field == "receipt_date":
        return bool(fields["receipt_date"]) and fields["receipt_date"].date().isoformat() == expected
    if field == "total_amount":
        got = fields["total_amount"]
        return got is not None and math.isclose(float(got), expected, abs_tol=0.01)
    if field == "currency":
        return fields["currency"] == expected
    if field == "category":
        return fields["category"] == expected
    if field == "item_count":
        return len(items) == expected
    raise ValueError(f"Unknown field '{field}' in expected.json")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Run a single file from expected.json")
    args = parser.parse_args()

    expected_all = json.loads((RECEIPTS / "expected.json").read_text(encoding="utf-8"))
    if args.only:
        expected_all = {args.only: expected_all[args.only]}

    hits, totals = defaultdict(int), defaultdict(int)
    flagged, rows = 0, []
    for name, expected in expected_all.items():
        path = RECEIPTS / name
        try:
            ex, usage = extract_receipt(path.read_bytes(), path.suffix)
        except Exception as e:
            print(f"✗ {name}: {e}")
            rows.append({"file": name, "error": str(e)})
            for field in expected:
                totals[field] += 1
            continue
        fields, items, reasons = build_receipt_data(ex, date.today())
        flagged += bool(reasons)
        result = {f: _check(f, v, fields, items) for f, v in expected.items()}
        for field, ok in result.items():
            totals[field] += 1
            hits[field] += ok
        misses = [f for f, ok in result.items() if not ok]
        mark = "✓" if not misses else "✗"
        print(f"{mark} {name}" + (f"  wrong: {', '.join(misses)}" if misses else "")
              + (f"  [review: {', '.join(reasons)}]" if reasons else ""))
        rows.append({
            "file": name,
            "wrong": misses,
            "review_reasons": reasons,
            "tokens": usage.total_tokens if usage else None,
            "got": {k: str(v) for k, v in fields.items() if k != "raw_text"} | {"item_count": len(items)},
        })

    print("\nField accuracy")
    summary = {}
    for field in totals:
        pct = 100 * hits[field] / totals[field]
        summary[field] = round(pct, 1)
        print(f"  {field:<14} {hits[field]:>3}/{totals[field]:<3} {pct:5.1f}%")
    print(f"  flagged for review: {flagged}/{len(expected_all)}")

    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"receipts-{datetime.now():%Y%m%d-%H%M%S}.json"
    out.write_text(
        json.dumps({"accuracy": summary, "flagged": flagged, "files": rows}, indent=2),
        encoding="utf-8",
    )
    print(f"\nSaved {out}")


if __name__ == "__main__":
    main()
