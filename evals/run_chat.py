"""
Chat answer accuracy against a dedicated eval user's real receipts.

Write cases in evals/chat_cases.json (format: evals/chat_cases.example.json). Each reply must
contain every string in "expect" (thousands separators are ignored). Cases with the same
"thread" run in order in one conversation, so follow-ups can be tested.

    uv run python -m evals.run_chat --user-id 7

Use an eval-only account: the conversations are saved to its chat history.
"""

import argparse
import json
import uuid
from pathlib import Path

from app.core.database import SessionLocal
from app.services.chat_service import chat_turn

ROOT = Path(__file__).parent


def _normalise(text: str) -> str:
    return text.replace(",", "").replace("٬", "").lower()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", type=int, required=True)
    args = parser.parse_args()

    cases = json.loads((ROOT / "chat_cases.json").read_text(encoding="utf-8"))
    threads: dict = {}
    passed = 0
    db = SessionLocal()
    try:
        for case in cases:
            key = case.get("thread") or uuid.uuid4().hex
            reply, threads[key] = chat_turn(db, args.user_id, case["question"], threads.get(key))
            missing = [e for e in case["expect"] if _normalise(e) not in _normalise(reply)]
            passed += not missing
            print(f"{'✓' if not missing else '✗'} {case['question']}")
            if missing:
                print(f"    missing {missing}\n    reply: {reply}")
    finally:
        db.close()
    print(f"\n{passed}/{len(cases)} passed")


if __name__ == "__main__":
    main()
