"""
Dummy settings so app modules import without a real .env (no network calls happen at import).
Set TEST_DATABASE_URL to a disposable Postgres database to also run the integration tests.
"""

import os

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://test:test@localhost/test"
)
for key, value in {
    "AZURE_OPENAI_ENDPOINT": "https://test.openai.azure.com",
    "AZURE_OPENAI_API_KEY": "test",
    "RECEIPT_DEPLOYMENT": "receipt-test",
    "CHAT_DEPLOYMENT": "chat-test",
    "JWT_SECRET_KEY": "test",
    "AZURE_STORAGE_CONNECTION_STRING": "",
    # Per-IP limits would trip on a test suite that logs in dozens of times a minute.
    "RATE_LIMIT_REGISTER_PER_MINUTE": "0",
    "RATE_LIMIT_LOGIN_PER_MINUTE": "0",
    "RATE_LIMIT_UPLOAD_PER_MINUTE": "0",
    "RATE_LIMIT_CHAT_PER_MINUTE": "0",
}.items():
    os.environ[key] = value
