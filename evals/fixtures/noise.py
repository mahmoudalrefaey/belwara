"""
OCR and typing noise for generated eval data.

The confusion sets here are deliberately broader than anything the matcher folds together
(they include pairs such as ر/و, م/ق and ل/ا that the matcher does not treat as equivalent), so
the evals measure how matching copes with realistic damage rather than replaying its own rules.
"""

import random
from typing import Callable, List

# Letters an OCR engine mistakes for one another on printed Arabic receipts.
_AR_CONFUSIONS = [
    "بتثنيى",
    "جحخ",
    "دذ",
    "رزو",
    "سش",
    "صض",
    "طظ",
    "عغفق",
    "هة",
    "اأإآل",
    "مق",
]
# Dotless forms some OCR engines emit when a dot is lost.
_DOT_DROP = {"ب": "ٮ", "ق": "ٯ", "ن": "ں", "ف": "ڡ", "ي": "ى", "ت": "ٮ", "ث": "ٮ"}
_LATIN_CONFUSIONS = [("rn", "m"), ("m", "rn"), ("l", "1"), ("I", "l"), ("O", "0"), ("o", "0"),
                     ("S", "5"), ("B", "8"), ("e", "c"), ("cl", "d")]

_AR_LETTERS = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي"


def _is_arabic(ch: str) -> bool:
    return "؀" <= ch <= "ۿ"


def _confusable_swap(s: str, rng: random.Random) -> str:
    spots = [i for i, ch in enumerate(s) if any(ch in g for g in _AR_CONFUSIONS)]
    if not spots:
        return s
    i = rng.choice(spots)
    group = next(g for g in _AR_CONFUSIONS if s[i] in g)
    return s[:i] + rng.choice([c for c in group if c != s[i]]) + s[i + 1:]


def _dot_drop(s: str, rng: random.Random) -> str:
    spots = [i for i, ch in enumerate(s) if ch in _DOT_DROP]
    if not spots:
        return s
    i = rng.choice(spots)
    return s[:i] + _DOT_DROP[s[i]] + s[i + 1:]


def _latin_swap(s: str, rng: random.Random) -> str:
    options = [(a, b) for a, b in _LATIN_CONFUSIONS if a in s]
    if not options:
        return s
    a, b = rng.choice(options)
    idx = [i for i in range(len(s)) if s.startswith(a, i)]
    i = rng.choice(idx)
    return s[:i] + b + s[i + len(a):]


def _delete_char(s: str, rng: random.Random) -> str:
    spots = [i for i, ch in enumerate(s) if ch.isalpha()]
    if len(spots) < 5:
        return s
    i = rng.choice(spots[1:-1])
    return s[:i] + s[i + 1:]


def _insert_char(s: str, rng: random.Random) -> str:
    i = rng.randrange(1, max(2, len(s)))
    ch = rng.choice(_AR_LETTERS) if any(_is_arabic(c) for c in s) else rng.choice("aeinorst")
    return s[:i] + ch + s[i:]


def _space_noise(s: str, rng: random.Random) -> str:
    if " " in s and rng.random() < 0.5:
        i = rng.choice([i for i, ch in enumerate(s) if ch == " "])
        return s[:i] + s[i + 1:]
    i = rng.randrange(2, max(3, len(s) - 1))
    return s[:i] + " " + s[i:] if s[i - 1] != " " and s[i] != " " else s


def _case_noise(s: str, rng: random.Random) -> str:
    return s.upper() if rng.random() < 0.5 else s.title()


_AR_OCR: List[Callable] = [_confusable_swap, _confusable_swap, _dot_drop, _delete_char, _insert_char,
                           _space_noise]
_LATIN_OCR: List[Callable] = [_latin_swap, _latin_swap, _delete_char, _insert_char, _space_noise,
                              _case_noise]


def ocr_corrupt(name: str, rng: random.Random, edits: int = 1) -> str:
    """Return `name` damaged by `edits` OCR-style errors (never returns the input unchanged)."""
    ops = _AR_OCR if any(_is_arabic(c) for c in name) else _LATIN_OCR
    out = name
    for _ in range(20):
        out = name
        for _ in range(edits):
            out = rng.choice(ops)(out, rng)
        if out != name:
            return out
    return name + ("ـ" if any(_is_arabic(c) for c in name) else ".")


# How people actually type names: orthographic variants, not OCR damage.
_TYPING_SWAPS = [("ي", "ى"), ("ى", "ي"), ("ة", "ه"), ("أ", "ا"), ("إ", "ا"), ("آ", "ا")]


def user_spelling(name: str, rng: random.Random) -> str:
    """A spelling a person might type for `name` (one variant applied, if any applies)."""
    options = [(a, b) for a, b in _TYPING_SWAPS if a in name]
    out = name
    if options:
        a, b = rng.choice(options)
        out = out.replace(a, b)
    words = out.split()
    if len(words) > 1 and words[0].startswith("ال") and rng.random() < 0.3:
        words[0] = words[0][2:]
        out = " ".join(words)
    if not any(_is_arabic(c) for c in out) and rng.random() < 0.5:
        out = out.lower()
    return out
