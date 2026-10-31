"""
Find which stored names a person means: merchant and item names as people type them, against
names as OCR stored them.

Layers, strongest first:
  1. exact       the stored name, ignoring case
  2. normalized  equal after Arabic/Latin normalization (letter forms, diacritics, digits, spacing)
  3. contains    every word the person typed appears in the stored name ("Seoudi" → "Seoudi Market")
  4. fuzzy       words aligned by edit distance on the normalized form and on an OCR "skeleton",
                 where letters that OCR confuses for one another are folded together
Scores rank candidates; stored variants of the same merchant are clustered, and distinct merchants
that match about equally well are reported as ambiguous instead of merged or guessed.

Stored data is never modified: every comparison runs on derived forms.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from rapidfuzz.distance import Levenshtein

# ── calibration ─────────────────────────────────────────────────────────────
# Tuned on evals/run_retrieval.py with the dev pool, checked on the holdout pool:
ACCEPT = 0.80        # a candidate scoring at least this is a match
SAME_MERCHANT = 0.80  # two stored names scoring this against each other are one merchant
MARGIN = 0.08        # the best merchant must beat the next by this much to be chosen alone
NEAREST = 0.55       # below ACCEPT but above this: offered as "did you mean"
RELATED = 0.30       # stored names scoring this against the query are considered for clustering
TOKEN_MATCH = 0.75   # a word pair at least this similar counts as the same word
SKELETON_WEIGHT = 0.92  # equal skeletons are strong evidence, but weaker than equal letters

# ── normalization ───────────────────────────────────────────────────────────
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_LETTERS = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ی": "ي", "ئ": "ي", "ة": "ه", "ؤ": "و",
    "ک": "ك", "ٮ": "ب", "ٯ": "ق", "ں": "ن", "ڡ": "ف",  # Persian and dotless forms OCR emits
})
_TATWEEL = "ـ"

# Letters that look alike in print, which OCR swaps: a fact about the scripts, not about our data.
_SKELETON = str.maketrans({
    **dict.fromkeys("بتثنيى", "ب"), **dict.fromkeys("جحخ", "ح"), "ذ": "د", "ز": "ر", "ش": "س",
    "ض": "ص", "ظ": "ط", **dict.fromkeys("عغفق", "ع"),
})
_LATIN_SKELETON = [("rn", "m"), ("vv", "w"), ("cl", "d"), ("0", "o"), ("1", "l"), ("i", "l"), ("5", "s")]

# Words naming a kind of business. Missing from a stored name, they say little about identity.
_BUSINESS_WORDS = {
    "مطعم", "مطاعم", "محل", "محلات", "ماركت", "سوبرماركت", "سوبر", "هايبر", "صيدليه", "مخبز", "مكتبه",
    "شركه", "مؤسسه", "فرع", "كافيه", "قهوه", "اسواق", "سوق", "مول",
    "restaurant", "cafe", "coffee", "store", "stores", "shop", "market", "supermarket", "hypermarket",
    "pharmacy", "bakery", "mall", "branch", "co", "company", "ltd", "llc", "inc",
}
_UNMATCHED_BUSINESS_WEIGHT = 0.3


def normalize(text: str) -> str:
    """Lowercase, Western digits, one form per Arabic letter, no diacritics, single spaces."""
    s = unicodedata.normalize("NFKC", text or "").translate(_DIGITS).translate(_LETTERS)
    # Decomposing then dropping combining marks removes Latin accents and Arabic tashkeel alike.
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = s.replace(_TATWEEL, "").casefold()
    s = re.sub(r"[^\w\s]|_", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _strip_article(word: str) -> str:
    return word[2:] if word.startswith("ال") and len(word) > 4 else word


def skeleton(word: str) -> str:
    out = word.translate(_SKELETON)
    for a, b in _LATIN_SKELETON:
        out = out.replace(a, b)
    return out


def _words(text: str) -> List[str]:
    return [_strip_article(w) for w in normalize(text).split()]


def _word_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if min(len(a), len(b)) <= 2:
        return 0.0  # very short words must match exactly
    plain = Levenshtein.normalized_similarity(a, b)
    shape = Levenshtein.normalized_similarity(skeleton(a), skeleton(b)) * SKELETON_WEIGHT
    if max(len(a), len(b)) <= 4:
        # One edit is a different word at this length ("لبن" milk vs "لبنه" labneh); only an
        # OCR look-alike (same skeleton) counts.
        return shape if skeleton(a) == skeleton(b) else 0.0
    return max(plain, shape)


def _coverage(source: List[str], target: List[str], *, soften_business: bool) -> float:
    """Weighted share of `source` words found in `target` (best match per word)."""
    if not source:
        return 0.0
    got = weight = 0.0
    for w in source:
        best = max((_word_similarity(w, t) for t in target), default=0.0)
        matched = best >= TOKEN_MATCH
        wt = 1.0
        if not matched and soften_business and w in _BUSINESS_WORDS:
            wt = _UNMATCHED_BUSINESS_WEIGHT
        weight += wt
        got += best * wt if matched else 0.0
    return got / weight


def score(query: str, candidate: str) -> Tuple[float, str]:
    """(0..1, method) for how well `candidate` (a stored name) matches what the person typed."""
    if query.strip().casefold() == candidate.strip().casefold():
        return 1.0, "exact"
    q, c = _words(query), _words(candidate)
    if not q or not c:
        return 0.0, "none"
    if q == c:
        return 0.98, "normalized"
    if all(w in c for w in q):
        # Everything typed is in the stored name; the more of the stored name it covers, the better.
        return 0.80 + 0.18 * _coverage(c, q, soften_business=False), "contains"
    words = 0.75 * _coverage(q, c, soften_business=True) + 0.25 * _coverage(c, q, soften_business=False)
    # Spacing damage ("SeoudiMarket", "حلواني علاء" → "حلوانيعلاء"): compare without spaces too.
    qs, cs = normalize(query).replace(" ", ""), normalize(candidate).replace(" ", "")
    joined = max(Levenshtein.normalized_similarity(qs, cs),
                 Levenshtein.normalized_similarity(skeleton(qs), skeleton(cs)) * SKELETON_WEIGHT)
    return max(words, joined * 0.97), "fuzzy"


# ── matching ────────────────────────────────────────────────────────────────

@dataclass
class Candidate:
    name: str
    receipts: int = 1
    in_scope: Optional[int] = None  # receipts inside the requested period/category, when known


@dataclass
class Group:
    """One real-world merchant (or item): its stored spellings and how well it matched."""

    name: str              # the spelling with most receipts
    variants: List[str]
    score: float
    method: str
    receipts: int
    in_scope: Optional[int] = None


@dataclass
class MatchResult:
    status: str                      # ok | ambiguous | no_results
    query: str
    matched: List[str] = field(default_factory=list)  # stored names to filter on
    groups: List[Group] = field(default_factory=list)  # matched groups, best first
    nearest: List[str] = field(default_factory=list)   # close but below the bar
    method: Optional[str] = None
    confidence: float = 0.0

    def describe(self) -> dict:
        """What the model sees about the match."""
        out = {"query": self.query, "method": self.method, "confidence": round(self.confidence, 2)}
        if self.groups:
            out["matched"] = [
                {"name": g.name, **({"also_stored_as": g.variants[1:]} if len(g.variants) > 1 else {})}
                for g in self.groups
            ]
        if self.nearest:
            out["nearest"] = self.nearest
        return out


def _same(a: str, b: str) -> bool:
    return min(score(a, b)[0], score(b, a)[0]) >= SAME_MERCHANT


def _cluster(cands: List[Candidate]) -> List[List[Candidate]]:
    """
    Group stored spellings of the same merchant (single linkage: a name joins every cluster it
    matches both ways, and those clusters merge). The spelling with most receipts leads.
    """
    clusters: List[List[Candidate]] = []
    for c in sorted(cands, key=lambda c: (-c.receipts, c.name)):
        linked = [cl for cl in clusters if any(_same(c.name, m.name) for m in cl)]
        merged = [m for cl in linked for m in cl] + [c]
        clusters = [cl for cl in clusters if cl not in linked] + [merged]
    for cl in clusters:
        cl.sort(key=lambda c: (-c.receipts, c.name))
    return clusters


def cluster_names(names: Sequence[Tuple[str, int]]) -> Dict[str, str]:
    """Stored name → representative name of its cluster (the spelling with most receipts)."""
    out = {}
    for cl in _cluster([Candidate(n, k) for n, k in names if n]):
        for c in cl:
            out[c.name] = cl[0].name
    return out


def match_names(query: str, alternatives: Optional[Sequence[str]], candidates: Sequence,
                *, union: bool = False) -> MatchResult:
    """
    Match `query` (or any of `alternatives`) against stored names.

    `candidates` are Candidate objects or (name, receipts) pairs. With `union=True` (items), every
    accepted group is used together — "milk" means all the milks. Otherwise (merchants) distinct
    merchants that match about equally well make the result ambiguous.
    """
    cands = [c if isinstance(c, Candidate) else Candidate(*c) for c in candidates if c]
    queries = [q for q in [query, *(alternatives or [])] if q and q.strip()]
    if not queries or not cands:
        return MatchResult("no_results", query or "")

    scored: Dict[str, Tuple[float, str]] = {}
    for c in cands:
        best = (0.0, "none")
        for i, q in enumerate(queries):
            s, m = score(q, c.name)
            if i and m != "exact":
                s, m = s * 0.99, "alternate"  # the person's own words win ties
            elif i:
                m = "alternate"
            best = max(best, (s, m))
        scored[c.name] = best

    if not any(s >= ACCEPT for s, _ in scored.values()):
        nearest = sorted((c.name for c in cands if scored[c.name][0] >= NEAREST),
                         key=lambda n: -scored[n][0])[:3]
        return MatchResult("no_results", query, nearest=nearest)

    # Cluster the accepted names, then pull in related spellings that link to one of them, so every
    # spelling of a matched merchant comes along, including damaged ones that don't resemble what
    # the person typed. Clusters joined by such a spelling merge (single linkage).
    clusters = _cluster([c for c in cands if scored[c.name][0] >= ACCEPT])
    related = [c for c in cands if RELATED <= scored[c.name][0] < ACCEPT]
    for c in sorted(related, key=lambda c: -scored[c.name][0]):
        linked = [cl for cl in clusters if any(_same(c.name, m.name) for m in cl)]
        if linked:
            clusters = [cl for cl in clusters if cl not in linked] + [[m for cl in linked for m in cl] + [c]]
    groups = []
    for cl in clusters:
        best = max(cl, key=lambda c: scored[c.name][0])
        in_scope = None if all(c.in_scope is None for c in cl) else sum(c.in_scope or 0 for c in cl)
        # Lead with the most-used spelling; on a tie, the one closest to what the person typed.
        cl.sort(key=lambda c: (-c.receipts, -scored[c.name][0], c.name))
        groups.append(Group(cl[0].name, [c.name for c in cl], scored[best.name][0], scored[best.name][1],
                            sum(c.receipts for c in cl), in_scope))
    matched_names = {n for g in groups for n in g.variants}
    nearest = sorted((c.name for c in cands if NEAREST <= scored[c.name][0] < ACCEPT
                      and c.name not in matched_names), key=lambda n: -scored[n][0])[:3]
    groups.sort(key=lambda g: (-g.score, -g.receipts))

    if union or len(groups) == 1:
        chosen = groups
    elif groups[0].score - groups[1].score >= MARGIN:
        chosen = groups[:1]
    else:
        # Close call. If only one of the close merchants has receipts in the requested scope, the
        # context settles it; otherwise ask.
        close = [g for g in groups if groups[0].score - g.score < MARGIN]
        scoped = [g for g in close if g.in_scope]
        if len(scoped) == 1 and all(g.in_scope is not None for g in close):
            chosen = scoped
        else:
            return MatchResult("ambiguous", query, [n for g in close for n in g.variants], close,
                               nearest, groups[0].method, groups[0].score)
    return MatchResult("ok", query, [n for g in chosen for n in g.variants], chosen, nearest,
                       chosen[0].method, chosen[0].score)
