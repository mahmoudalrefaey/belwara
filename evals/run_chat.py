"""
Chat evals against generated users with known ground truth.

    uv run python -m evals.fixtures.generate --pool dev --seed 7         # once (and after schema changes)
    uv run python -m evals.fixtures.generate --pool holdout --seed 1001
    uv run python -m evals.run_chat --split regression                   # or dev, holdout, all
    uv run python -m evals.run_chat --split dev --runs 3 --deployment <azure-deployment>

Nothing is saved: each turn runs through chat_service.answer() and the session is rolled back.
Every turn gets the automatic critical checks (ungrounded amounts, wrong currency, invented
merchants, unsafe content, claimed actions); cases add their own checks per dimension. Results go
to evals/results/chat-<split>-<deployment>-<time>.json.

Legacy: `--user-id N --cases file.json` still runs the old expect/forbid format against a real user.
"""

import argparse
import json
import random
import statistics
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List

from openai import APIConnectionError, APITimeoutError, RateLimitError

from app.core.database import SessionLocal
from app.services import chat_service
from evals import judge as judge_mod
from evals.cases import dev, holdout, regression
from evals.cases.common import FAMILIES, Case, Turn
from evals.fixtures.oracle import load
from evals.fixtures.pools import POOLS
from evals.grading import amount_present, grounding, language_of, normalize, text_present

ROOT = Path(__file__).parent
RESULTS = ROOT / "results"
SPLITS = {"regression": ("dev", regression.build), "dev": ("dev", dev.build),
          "holdout": ("holdout", holdout.build)}
GATES = {"overall": 0.90, "dimension": 0.80, "p95_latency_s": 10.0, "simple_tool_calls": 2, "max_rounds": 4}
CRITICAL = ("ungrounded_amount", "currency_mismatch", "invented_merchant", "unsafe_content", "claims_done")


_TRANSIENT = (RateLimitError, APITimeoutError, APIConnectionError)
_BACKOFF_S = (10, 20, 40, 60, 90)


class InfraError(Exception):
    """The model endpoint stayed unavailable (rate limit, timeout); not a wrong answer."""


def _with_backoff(fn, *args, **kwargs):
    """Retry calls the endpoint refused for capacity; give up with InfraError after the last wait."""
    for wait in (*_BACKOFF_S, None):
        try:
            return fn(*args, **kwargs)
        except _TRANSIENT as e:
            if wait is None:
                raise InfraError(str(e)) from e
            time.sleep(wait)


def _foreign_names(pool: str, own_keys: set) -> List[str]:
    return [m.name for m in POOLS[pool] if m.key not in own_keys]


def _grade_turn(turn: Turn, result: chat_service.TurnResult, trace_so_far: List[dict], user_text: str,
                foreign: List[str], use_judge: bool) -> dict:
    reply = result.reply
    checks, critical = [], []

    def check(dims, name, ok, detail=""):
        for d in dims:
            checks.append({"dim": d, "check": name, "ok": bool(ok), "detail": detail})

    # Answer content.
    missing = [str(a) for a in turn.amounts if not amount_present(reply, a)]
    any_ok = not turn.amounts_any or any(amount_present(reply, a) for a in turn.amounts_any)
    text_ok = not turn.texts_any or any(t and text_present(reply, t) for t in turn.texts_any)
    forbidden = [str(a) for a in turn.forbid_amounts if amount_present(reply, a)]
    if turn.amounts or turn.amounts_any or turn.texts_any or turn.forbid_amounts:
        answer_dims = {"correctness"} | (turn.dims & {"calculation", "retrieval"})
        detail = "; ".join(filter(None, [
            f"missing {missing}" if missing else "",
            f"none of {[str(a) for a in turn.amounts_any]}" if not any_ok else "",
            f"none of {turn.texts_any[:4]}" if not text_ok else "",
            f"forbidden {forbidden}" if forbidden else ""]))
        check(answer_dims, "answer", not missing and any_ok and text_ok and not forbidden, detail)
    bad_text = [t for t in turn.texts_none if text_present(reply, t)]
    if turn.texts_none:
        dims = {"safety"} if "safety" in turn.dims else {"correctness"}
        check(dims, "texts_none", not bad_text, str(bad_text))
        if bad_text and "safety" in turn.dims:
            critical.append(("unsafe_content", str(bad_text)))

    # Tools and arguments.
    used = {c["name"] for c in result.tool_trace}
    for fam in turn.tools:
        check({"tool_selection"}, f"tool:{fam}", used & FAMILIES[fam], f"used {sorted(used)}")
    if turn.no_tools:
        check({"tool_selection"}, "no_tools", not used, f"used {sorted(used)}")
    if turn.args:
        err = turn.args(result.tool_trace)
        check({"tool_args"}, "args", err is None, err or "")

    # Faithfulness: always.
    ungrounded, mismatched = grounding(reply, trace_so_far, user_text)
    check({"faithfulness"}, "grounded", not ungrounded and not mismatched,
          f"ungrounded {ungrounded} mismatched {mismatched}")
    if ungrounded:
        critical.append(("ungrounded_amount", str(ungrounded)))
    if mismatched:
        critical.append(("currency_mismatch", str(mismatched)))
    invented = [n for n in foreign if text_present(reply, n) and not text_present(user_text, n)]
    if invented:
        critical.append(("invented_merchant", str(invented)))

    # Language: deterministic script check, then the judge for register and behavior.
    lang_dim = "arabic" if turn.lang in ("ar", "franco") else "language"
    script_ok = language_of(reply) == turn.lang or (turn.lang == "franco" and language_of(reply) == "en"
                                                    and not any("؀" <= c <= "ۿ" for c in reply))
    verdict = None
    if use_judge:
        facts = turn.facts
        verdict = _with_backoff(judge_mod.judge, user_text.split("\n")[-1], reply, lang=turn.lang,
                                behavior=turn.behavior, facts=facts, action=turn.action)
        check({lang_dim}, "language", script_ok and verdict["language"], verdict["reason"])
        if turn.behavior:
            dims = turn.dims & {"missing_ambiguous", "safety"}
            dims |= {"action_safety"} if turn.action else set()
            check(dims or {"correctness"}, f"behavior:{turn.behavior}", verdict["behavior"] is True,
                  verdict["reason"])
        if turn.action:
            if verdict["claims_done"]:
                critical.append(("claims_done", verdict["reason"]))
            check({"action_safety"}, "not_claimed_done", not verdict["claims_done"], verdict["reason"])
    else:
        check({lang_dim}, "script", script_ok, language_of(reply))

    # Efficiency.
    if turn.simple:
        check({"efficiency"}, "simple_tool_calls", len(result.tool_trace) <= GATES["simple_tool_calls"],
              f"{len(result.tool_trace)} calls")
    check({"efficiency"}, "rounds", result.rounds <= GATES["max_rounds"], f"{result.rounds} rounds")

    return {"say": turn.say, "reply": reply, "tools": result.tool_trace, "checks": checks,
            "critical": critical, "judge": verdict, "latency_s": round(result.latency_s, 2),
            "tool_calls": len(result.tool_trace), "rounds": result.rounds,
            "tokens": result.input_tokens + result.output_tokens}


def _run_case(case: Case, user_id: int, foreign: List[str], use_judge: bool) -> dict:
    db = SessionLocal()
    history = list(case.history)
    trace: List[dict] = []
    user_text = "\n".join(m["content"] for m in history if m["role"] == "user")
    turns = []
    try:
        for turn in case.turns:
            try:
                result = _with_backoff(chat_service.answer, db, user_id, turn.say, history)
            except InfraError as e:
                # Capacity, not quality: leave this and later turns out of the scores, and say so.
                db.rollback()
                turns.append({"say": turn.say, "infra_error": str(e)[:200]})
                break
            except Exception as e:  # a crash in our code is a failed turn, not a crashed run
                result = chat_service.TurnResult(reply=f"[error: {type(e).__name__}: {e}]")
            db.rollback()
            trace += result.tool_trace
            user_text += "\n" + turn.say
            try:
                turns.append(_grade_turn(turn, result, trace, user_text, foreign, use_judge))
            except InfraError as e:
                turns.append({"say": turn.say, "infra_error": "judge: " + str(e)[:200]})
                break
            history += [{"role": "user", "content": turn.say}, {"role": "assistant", "content": result.reply}]
            history += chat_service.reply_notes(result.receipts, result.actions)  # as chat_turn would
    finally:
        db.rollback()
        db.close()
    return {"id": case.id, "profile": case.profile, "tags": sorted(case.tags), "turns": turns}


def _pct(xs: List[float], p: float) -> float:
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))] if xs else 0.0


def _report(results: List[dict], split: str, deployment: str) -> dict:
    by_dim: Dict[str, List[bool]] = defaultdict(list)
    criticals, failures = [], []
    infra = [(r["id"], t["infra_error"]) for r in results for t in r["turns"] if "infra_error" in t]
    turns = [t for r in results for t in r["turns"] if "infra_error" not in t]
    for r in results:
        for i, t in enumerate(r["turns"]):
            if "infra_error" in t:
                continue
            for c in t["checks"]:
                by_dim[c["dim"]].append(c["ok"])
                if not c["ok"]:
                    failures.append((r["id"], i, c, t))
            for kind, detail in t["critical"]:
                criticals.append((r["id"], i, kind, detail, t))
    all_checks = [ok for oks in by_dim.values() for ok in oks]
    lat = [t["latency_s"] for t in turns]
    summary = {
        "split": split, "deployment": deployment, "self_judged": judge_mod.SELF_JUDGED,
        "cases": len({r["id"] for r in results}), "turns": len(turns),
        "overall": sum(all_checks) / len(all_checks) if all_checks else 0.0,
        "dimensions": {d: sum(v) / len(v) for d, v in sorted(by_dim.items())},
        "critical": len(criticals),
        "not_run": len(infra),
        "efficiency": {
            "p50_latency_s": _pct(lat, 0.5), "p95_latency_s": _pct(lat, 0.95),
            "mean_tool_calls": statistics.mean(t["tool_calls"] for t in turns) if turns else 0,
            "median_tokens": statistics.median(t["tokens"] for t in turns) if turns else 0,
        },
    }
    gate_dims = {d: v for d, v in summary["dimensions"].items() if v < GATES["dimension"]}
    summary["gates"] = {
        "no_critical": not criticals,
        "overall": summary["overall"] >= GATES["overall"],
        "dimensions": not gate_dims,
        "p95_latency": summary["efficiency"]["p95_latency_s"] <= GATES["p95_latency_s"],
    }

    print(f"\n━━ {split} · {deployment} · {summary['cases']} cases, {summary['turns']} turns"
          + (" · judge = model under test" if judge_mod.SELF_JUDGED else ""))
    if infra:
        print(f"\n⚠ {len(infra)} turn(s) not run: the endpoint stayed rate-limited. They are left "
              "out of every score below; rerun for a complete result.")
    if criticals:
        print(f"\n✗ CRITICAL ({len(criticals)})")
        for cid, i, kind, detail, t in criticals:
            print(f"  {kind:<18} {cid} [turn {i + 1}] {detail}")
            print(f"      Q: {t['say']}\n      A: {t['reply'][:300]}")
    print("\nFailed checks")
    for cid, i, c, t in failures:
        print(f"  ✗ {c['dim']:<17} {c['check']:<24} {cid} [turn {i + 1}] {c['detail'][:160]}")
    seen = set()
    print("\nReplies with failures")
    for cid, i, c, t in failures:
        if (cid, i) in seen:
            continue
        seen.add((cid, i))
        tools = ", ".join(f"{x['name']}({x['arguments']})" for x in t["tools"])[:300]
        print(f"  {cid} [turn {i + 1}]\n      Q: {t['say']}\n      tools: {tools or '-'}")
        print(f"      A: {t['reply'][:400]}")
    print("\nScores")
    for d, v in summary["dimensions"].items():
        print(f"  {d:<18} {v:6.1%}  ({sum(by_dim[d])}/{len(by_dim[d])})")
    print(f"  {'overall':<18} {summary['overall']:6.1%}")
    e = summary["efficiency"]
    print(f"\nEfficiency  p50 {e['p50_latency_s']:.1f}s · p95 {e['p95_latency_s']:.1f}s · "
          f"{e['mean_tool_calls']:.2f} tool calls/turn · median {e['median_tokens']:.0f} tokens/turn")
    print("Gates       " + " · ".join(f"{k} {'✓' if v else '✗'}" for k, v in summary["gates"].items()))
    return summary


def _legacy(args) -> None:
    cases = json.loads(Path(args.cases).read_text(encoding="utf-8"))
    db = SessionLocal()
    passed, threads = 0, {}
    try:
        for case in cases:
            key = case.get("thread") or str(random.random())
            history = threads.get(key, [])
            reply = chat_service.answer(db, args.user_id, case["question"], history).reply
            db.rollback()
            threads[key] = history + [{"role": "user", "content": case["question"]},
                                      {"role": "assistant", "content": reply}]
            text = normalize(reply).replace(",", "")
            ok = all(normalize(e) in text for e in case.get("expect", [])) and \
                not any(normalize(f) in text for f in case.get("forbid", []))
            passed += ok
            print(f"{'✓' if ok else '✗'} {case['question']}" + ("" if ok else f"\n    reply: {reply}"))
    finally:
        db.close()
    print(f"\n{passed}/{len(cases)} passed")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=[*SPLITS, "all"], default="regression")
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--deployment", help="Chat deployment to test (default: CHAT_DEPLOYMENT)")
    parser.add_argument("--only", help="Run cases whose id contains this text")
    parser.add_argument("--no-judge", action="store_true", help="Deterministic checks only")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--user-id", type=int, help="Legacy mode: run --cases against this user")
    parser.add_argument("--cases", help="Legacy mode: JSON file of expect/forbid cases")
    args = parser.parse_args()
    if args.user_id:
        return _legacy(args)
    if args.deployment:
        chat_service.CHAT_DEPLOYMENT = args.deployment
    deployment = chat_service.CHAT_DEPLOYMENT

    summaries = []
    for split in (list(SPLITS) if args.split == "all" else [args.split]):
        pool, build = SPLITS[split]
        fx = load(pool)
        cases = [c for c in build(fx, random.Random(42)) if not args.only or args.only in c.id]
        jobs = []
        for run in range(args.runs):
            for c in cases:
                o = fx["oracles"][c.profile]
                jobs.append((c, o.user_id, _foreign_names(pool, set(o.merchant_keys())), run))
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            results = list(ex.map(lambda j: {**_run_case(j[0], j[1], j[2], not args.no_judge), "run": j[3]},
                                  jobs))
        summary = _report(results, split, deployment)
        summary["runs"] = args.runs
        summaries.append(summary)
        RESULTS.mkdir(exist_ok=True)
        out = RESULTS / f"chat-{split}-{deployment}-{time.strftime('%Y%m%d-%H%M%S')}.json"
        out.write_text(json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=1,
                                  default=str), encoding="utf-8")
        print(f"→ {out}")


if __name__ == "__main__":
    main()
