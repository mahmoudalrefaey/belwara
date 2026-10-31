"""
Merge labelled batches into expected.json and score a receipt-health run against them.

    uv run python -m evals.compare_labels [--health evals/results/receipt-health-<ts>.json]

Human verdicts in labels/corrections.json override the model labels (they win on every merge).
Labels with a null value are left out of expected.json (the field is not checked for that file).
Disagreements are printed so a person can look at the image and decide who is right.
"""

import argparse
import glob
import json
import math
from collections import defaultdict
from pathlib import Path

RESULTS = Path(__file__).parent / "results"
FIELDS = ("merchant_name", "receipt_date", "total_amount", "currency", "category", "item_count")


def _match(field, want, got):
    if got is None:
        return False
    if field == "merchant_name":
        g, w = got.lower().strip(), want.lower().strip()
        return bool(g) and (w in g or g in w)
    if field == "total_amount":
        return math.isclose(float(got), float(want), abs_tol=0.01)
    return str(got).lower() == str(want).lower()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--health", default=sorted(glob.glob(str(RESULTS / "receipt-health-*.json")))[-1])
    args = parser.parse_args()

    labels = {}
    for f in sorted(glob.glob(str(RESULTS / "labels" / "batch_*.json"))):
        labels.update(json.loads(Path(f).read_text(encoding="utf-8")))
    fixes_path = RESULTS / "labels" / "corrections.json"
    fixes = json.loads(fixes_path.read_text(encoding="utf-8")) if fixes_path.exists() else {}
    for name, fields in fixes.items():
        labels.setdefault(name, {}).update(fields, confidence="high")
    expected = {n: {k: lab[k] for k in FIELDS if lab.get(k) is not None} for n, lab in labels.items()}
    (RESULTS / "labels" / "expected.json").write_text(
        json.dumps(expected, indent=2, ensure_ascii=False), encoding="utf-8")
    low = sorted(n for n, lab in labels.items() if lab.get("confidence") != "high")
    print(f"{len(labels)} labelled, {len(low)} low confidence, {len(fixes)} human-corrected")

    health = {f["file"]: f for f in json.loads(Path(args.health).read_text(encoding="utf-8"))["files"]}
    hits, tot, runs_all_ok = defaultdict(int), defaultdict(int), 0
    wrong_by_file = {}
    for name, exp in expected.items():
        runs = [r for r in health.get(name, {}).get("runs", []) if "error" not in r]
        wrong = set()
        for r in runs:
            for f, want in exp.items():
                tot[f] += 1
                ok = _match(f, want, r["fields"][f])
                hits[f] += ok
                if not ok:
                    wrong.add(f)
        if runs and not wrong:
            runs_all_ok += 1
        if wrong:
            wrong_by_file[name] = wrong
    print("\nField accuracy vs Sonnet labels (every run counted)")
    for f in FIELDS:
        if tot[f]:
            print(f"  {f:<14} {hits[f]:>3}/{tot[f]:<3} {100 * hits[f] / tot[f]:5.1f}%")
    print(f"  receipts with every labelled field right in every run: {runs_all_ok}/{len(expected)}")
    print(f"\nDisagreements ({len(wrong_by_file)} receipts):")
    for name, wrong in sorted(wrong_by_file.items()):
        flag = " [low-conf label]" if name in low else ""
        got = [r["fields"] for r in health[name]["runs"] if "error" not in r]
        print(f"  {name}{flag}: {sorted(wrong)}")
        for f in sorted(wrong):
            print(f"      {f}: label={expected[name][f]!r}  app={[g[f] for g in got]}")


if __name__ == "__main__":
    main()
