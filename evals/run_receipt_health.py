"""
Label-free reliability report for the receipt reader.

Needs no expected values: it runs every receipt in a folder N times and measures how often the
reader fails, flags a receipt for review, contradicts its own arithmetic, or changes its answer
between runs. "Silent risk" is a receipt that looks wrong by those signals but was not flagged,
which is the case a user would never be warned about.

    uv run python -m evals.run_receipt_health --dir receipts_for_evals --runs 2
    uv run python -m evals.run_receipt_health --limit 5          # cheap smoke test

Raw model outputs are saved next to the report so labelling can reuse them without new calls.
"""

import argparse
import json
import math
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

from openai import APIConnectionError, APITimeoutError, RateLimitError

from app.services.extract_service import build_receipt_data, extract_receipt

ROOT = Path(__file__).parent
RESULTS = ROOT / "results"
SUFFIXES = {".png", ".jpg", ".jpeg", ".pdf", ".webp"}
BACKOFF_S = (10, 20, 40, 60, 90)
# The dataset's receipts are old, so this rule would flag all of them and hide the real signal.
IGNORED_REASONS = {"date_too_old"}
STABLE_FIELDS = ("merchant_name", "receipt_date", "total_amount", "currency", "category", "item_count")


def _extract(path: Path):
    for wait in (*BACKOFF_S, None):
        try:
            return extract_receipt(path.read_bytes(), path.suffix)
        except (RateLimitError, APITimeoutError, APIConnectionError):
            if wait is None:
                raise
            time.sleep(wait)


def _run_once(path: Path) -> dict:
    try:
        ex, usage = _extract(path)
    except Exception as e:  # noqa: BLE001 - any failure is a data point
        return {"error": f"{type(e).__name__}: {e}"[:300]}
    fields, items, reasons = build_receipt_data(ex, date.today())
    return {
        "raw": ex.model_dump(),
        "reasons": reasons,
        "is_receipt": ex.is_receipt,
        "tokens": usage.total_tokens if usage else None,
        "fields": {
            "merchant_name": fields["merchant_name"],
            "receipt_date": fields["receipt_date"].date().isoformat() if fields["receipt_date"] else None,
            "total_amount": str(fields["total_amount"]) if fields["total_amount"] is not None else None,
            "currency": fields["currency"],
            "category": fields["category"],
            "item_count": len(items),
        },
    }


def _arithmetic_problem(raw: dict) -> Optional[str]:
    """The printed totals must agree with each other; the app only checks the line items."""
    total, sub = raw.get("total_amount"), raw.get("subtotal")
    tax, other = raw.get("total_taxes") or 0, raw.get("other_charges") or 0
    if total is None or sub is None:
        return None
    if math.isclose(sub + tax + other, total, rel_tol=0.02, abs_tol=0.05):
        return None
    if math.isclose(sub, total, rel_tol=0.02, abs_tol=0.05):  # subtotal already includes tax
        return None
    return f"subtotal {sub} + tax {tax} + other {other} != total {total}"


def _unstable_fields(runs: List[dict]) -> List[str]:
    ok = [r for r in runs if "error" not in r]
    if len(ok) < 2:
        return []
    out = []
    for f in STABLE_FIELDS:
        values = {str(r["fields"][f]).strip().lower() for r in ok}
        if len(values) > 1:
            out.append(f)
    return out


def _judge(runs: List[dict]) -> dict:
    ok = [r for r in runs if "error" not in r]
    if not ok:
        return {"failed": True, "flagged": False, "arithmetic": None, "unstable": [], "silent_risk": False,
                "no_total": True, "not_receipt": False}
    flagged = any(set(r["reasons"]) - IGNORED_REASONS for r in ok)
    arithmetic = next((p for p in (_arithmetic_problem(r["raw"]) for r in ok) if p), None)
    unstable = _unstable_fields(runs)
    no_total = any(r["fields"]["total_amount"] is None for r in ok)
    return {
        "failed": len(ok) < len(runs), "flagged": flagged, "arithmetic": arithmetic, "unstable": unstable,
        "no_total": no_total, "not_receipt": any(not r["is_receipt"] for r in ok),
        # Wrong-looking, yet nothing told the user to check it.
        "silent_risk": (bool(arithmetic) or bool(unstable)) and not flagged,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default=str(ROOT.parent / "receipts_for_evals"))
    parser.add_argument("--runs", type=int, default=2)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--limit", type=int, help="Only the first N receipts")
    args = parser.parse_args()

    files = sorted(p for p in Path(args.dir).iterdir() if p.suffix.lower() in SUFFIXES)
    if args.limit:
        files = files[:args.limit]
    print(f"{len(files)} receipts x {args.runs} runs = {len(files) * args.runs} calls")

    jobs = [(p, i) for p in files for i in range(args.runs)]
    started = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        outputs = list(pool.map(lambda j: _run_once(j[0]), jobs))

    per_file: Dict[str, List[dict]] = {}
    for (path, _), out in zip(jobs, outputs):
        per_file.setdefault(path.name, []).append(out)

    rows, tally = [], Counter()
    for name, runs in per_file.items():
        verdict = _judge(runs)
        rows.append({"file": name, **verdict, "runs": runs})
        for key in ("failed", "no_total", "not_receipt", "flagged", "silent_risk"):
            tally[key] += bool(verdict[key])
        tally["arithmetic"] += bool(verdict["arithmetic"])
        tally["old_date_ignored"] += any("date_too_old" in r.get("reasons", []) for r in runs)
        tally["unstable"] += bool(verdict["unstable"])
        for f in verdict["unstable"]:
            tally[f"unstable:{f}"] += 1
        if verdict["silent_risk"]:
            why = verdict["arithmetic"] or f"unstable {verdict['unstable']}"
            print(f"! silent risk  {name}: {why}")

    n = len(rows)
    tokens = [r["tokens"] for run in per_file.values() for r in run if r.get("tokens")]
    print(f"\nReliability over {n} receipts ({args.runs} runs each, {time.time() - started:.0f}s)")
    for label, key in (("extraction failed (any run)", "failed"), ("no total read", "no_total"),
                       ("judged not a receipt", "not_receipt"), ("flagged for review", "flagged"),
                       ("printed totals don't add up", "arithmetic"),
                       ("answer changed between runs", "unstable"), ("SILENT RISK", "silent_risk")):
        print(f"  {label:<30} {tally[key]:>3}/{n}  {100 * tally[key] / n:5.1f}%")
    print("  unstable by field: " + (", ".join(f"{f}={tally[f'unstable:{f}']}" for f in STABLE_FIELDS
                                               if tally[f"unstable:{f}"]) or "none"))
    print(f"  (receipts hit by the ignored 'date_too_old' rule: {tally['old_date_ignored']}/{n})")
    if tokens:
        print(f"  tokens per call: mean {sum(tokens) / len(tokens):.0f}, total {sum(tokens)}")

    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"receipt-health-{datetime.now():%Y%m%d-%H%M%S}.json"
    out.write_text(json.dumps({"receipts": n, "runs": args.runs, "tally": dict(tally), "files": rows},
                              indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSaved {out}")


if __name__ == "__main__":
    main()
