"""The per-turn language hint that keeps Wara'a answering in the user's language."""

import pytest

from app.services.chat_service import _language_hint


@pytest.mark.parametrize(
    "message, expected",
    [
        ("صرفت كام الشهر ده؟", "Arabic"),
        ("كم أنفقت في سبتمبر؟", "Arabic"),
        ("What's your name?", "English"),
        ("How much did I spend on food?", "English"),
        ("sraft kam f akher fatoora?", "Franco"),
        ("ana 3ayez a3raf masrofaty", "Franco"),
        ("?!", "language the user has been using"),
    ],
)
def test_language_hint(message, expected):
    assert expected in _language_hint(message)
