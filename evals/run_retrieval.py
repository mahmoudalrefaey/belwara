"""
Merchant-name matching accuracy, without the LLM.

For each pool, a simulated user has every merchant stored under its printed name plus several
OCR-damaged variants. Queries are written the ways people write them (exact, typed spelling,
a typo, a distinctive part of the name), and we check what the matcher returns:

  hit        status ok, everything returned belongs to the intended merchant, at least one name found
  recall     share of the intended merchant's stored names that were returned
  wrong      status ok but a *different* merchant was returned — the dangerous case (gate ≤ 1%)
  ambiguous  the matcher asked instead of answering (fine for a shared word, a miss otherwise)
  absent     a name the user never visited: anything returned with status ok is a false match

    uv run python -m evals.run_retrieval                  # current app matcher
    uv run python -m evals.run_retrieval --matcher ilike  # what the app did before (substring)
"""

import argparse
import random
from collections import defaultdict
from typing import Callable, Dict, List, Tuple

from evals.fixtures import noise
from evals.fixtures.pools import POOLS

Matcher = Callable[[str, List[str], List[str]], Tuple[str, List[str]]]


def ilike_matcher(query: str, alternatives: List[str], candidates: List[str]) -> Tuple[str, List[str]]:
    """The old behavior: case-insensitive substring of the stored name."""
    found = [c for c in candidates if query.strip().lower() in c.lower()]
    return ("ok" if found else "no_results"), found


def app_matcher(query: str, alternatives: List[str], candidates: List[str]) -> Tuple[str, List[str]]:
    from app.services import match_service

    result = match_service.match_names(query, alternatives, [(c, 1) for c in candidates])
    return result.status, result.matched


def _world(pool_name: str, rng: random.Random):
    pool = POOLS[pool_name]
    owner: Dict[str, str] = {}
    for m in pool:
        owner[m.name] = m.key
        for _ in range(3):
            owner.setdefault(noise.ocr_corrupt(m.name, rng, edits=rng.choice([1, 1, 2])), m.key)
    return pool, owner


def _queries(pool, rng: random.Random, shared: Dict[str, set]):
    for m in pool:
        yield "exact", m, m.name
        yield "typed", m, noise.user_spelling(m.name, rng)
        yield "typo", m, noise.ocr_corrupt(m.name, rng)
        words = [w for w in m.name.split() if len(w) > 3 and len(shared[w]) == 1]
        if len(m.name.split()) > 1 and words:
            # A distinctive part people use on its own (a word no other merchant has).
            yield "part", m, max(words, key=len)


def evaluate(matcher: Matcher, pool_name: str, seed: int) -> Dict[str, Dict[str, float]]:
    rng = random.Random(seed)
    pool, owner = _world(pool_name, rng)
    candidates = list(owner)
    shared = defaultdict(set)  # words used by more than one merchant
    for m in pool:
        for w in m.name.split():
            shared[w].add(m.key)
    stats: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for kind, m, q in _queries(pool, rng, shared):
        status, found = matcher(q, [], candidates)
        mine = {c for c, k in owner.items() if k == m.key}
        s = stats[kind]
        s["n"] += 1
        others = [c for c in found if owner.get(c) != m.key]
        s["hit"] += status == "ok" and bool(found) and not others
        s["recall"] += len(mine & set(found)) / len(mine)
        s["wrong"] += status == "ok" and bool(others)
        s["ambiguous"] += status == "ambiguous"

    # A word two merchants share: the matcher must ask. Returning one of them, or both merged into
    # one answer, is wrong.
    for word, keys in shared.items():
        if len(keys) < 2 or len(word) < 3:
            continue
        status, found = matcher(word, [], candidates)
        s = stats["shared_word"]
        s["n"] += 1
        hit_keys = {owner[c] for c in found if c in owner}
        s["hit"] += status == "ambiguous"
        s["wrong"] += status == "ok" and bool(hit_keys)
        s["ambiguous"] += status == "ambiguous"

    # Merchants from the other pool: never visited.
    other = next(p for p in POOLS if p != pool_name)
    for m in POOLS[other]:
        status, found = matcher(m.name, [], candidates)
        s = stats["absent"]
        s["n"] += 1
        s["hit"] += status != "ok" or not found
        s["wrong"] += status == "ok" and bool(found)
    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matcher", choices=["app", "ilike"], default="app")
    parser.add_argument("--pool", choices=sorted(POOLS), action="append")
    parser.add_argument("--seeds", type=int, default=5)
    args = parser.parse_args()
    matcher = app_matcher if args.matcher == "app" else ilike_matcher

    for pool in args.pool or sorted(POOLS):
        total: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for seed in range(args.seeds):
            for kind, s in evaluate(matcher, pool, seed).items():
                for k, v in s.items():
                    total[kind][k] += v
        print(f"\n{pool} · matcher={args.matcher} · {args.seeds} seeds")
        print(f"  {'query':<12}{'n':>5}{'hit':>8}{'recall':>8}{'wrong':>8}{'ambig':>8}")
        wrong = n = 0
        for kind in ("exact", "typed", "typo", "part", "shared_word", "absent"):
            s = total[kind]
            if not s["n"]:
                continue
            n += s["n"]
            wrong += s["wrong"]
            recall = f"{s['recall'] / s['n']:8.1%}" if kind not in ("shared_word", "absent") else f"{'-':>8}"
            print(f"  {kind:<12}{int(s['n']):>5}{s['hit'] / s['n']:8.1%}{recall}"
                  f"{s['wrong'] / s['n']:8.1%}{s['ambiguous'] / s['n']:8.1%}")
        print(f"  confident wrong matches: {wrong / n:.1%} (gate ≤ 1%)")


if __name__ == "__main__":
    main()
