"""Central configuration — reads all env vars from .env once."""

import os
from dotenv import load_dotenv

load_dotenv()


def _required(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise RuntimeError(f"{name} is not set in .env")
    return value


# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL: str = _required("DATABASE_URL")
DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
DB_POOL_MAX_OVERFLOW: int = int(os.getenv("DB_POOL_MAX_OVERFLOW", "10"))

# ── Azure OpenAI (v1 API; model= takes a deployment name) ─────────────────────
# Without an API key the app authenticates with its managed identity (Entra ID).
AZURE_OPENAI_ENDPOINT: str = _required("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
RECEIPT_DEPLOYMENT: str = _required("RECEIPT_DEPLOYMENT")
CHAT_DEPLOYMENT: str = _required("CHAT_DEPLOYMENT")
LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "90"))
LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "3"))

# ── Receipt file storage: Azure Blob when set, local folder otherwise (dev) ──
# Use the account URL (managed identity) in Azure, or a connection string (e.g. Azurite).
AZURE_STORAGE_ACCOUNT_URL: str = os.getenv("AZURE_STORAGE_ACCOUNT_URL", "")
AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_STORAGE_CONTAINER: str = os.getenv("AZURE_STORAGE_CONTAINER", "receipts")
RECEIPTS_IMG_DIR: str = os.getenv("RECEIPTS_IMG_DIR", "receipts_img")

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET_KEY: str = _required("JWT_SECRET_KEY")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

# ── Currency conversion (optional; chat says so when missing) ─────────────────
CURRENCYFREAKS_API_KEY: str = os.getenv("CURRENCYFREAKS_API_KEY", "")

# ── Upload limits ─────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))  # 15 MiB
MAX_FILES_PER_UPLOAD: int = int(os.getenv("MAX_FILES_PER_UPLOAD", "10"))
MAX_PDF_PAGES: int = int(os.getenv("MAX_PDF_PAGES", "5"))

# ── Receipt list / search defaults ────────────────────────────────────────────
DEFAULT_RECEIPT_PAGE_SIZE: int = int(os.getenv("DEFAULT_RECEIPT_PAGE_SIZE", "20"))
MAX_RECEIPT_PAGE_SIZE: int = int(os.getenv("MAX_RECEIPT_PAGE_SIZE", "100"))
SEARCH_RESULTS_CAP: int = int(os.getenv("SEARCH_RESULTS_CAP", "50"))

# ── Chat ──────────────────────────────────────────────────────────────────────
CHAT_HISTORY_MESSAGES: int = int(os.getenv("CHAT_HISTORY_MESSAGES", "20"))
CHAT_MAX_TOOL_STEPS: int = int(os.getenv("CHAT_MAX_TOOL_STEPS", "5"))

# ── Plan quotas per calendar month (0 = unlimited) ────────────────────────────
PLAN_LIMITS: dict = {
    "free": {
        "receipts": int(os.getenv("FREE_RECEIPTS_PER_MONTH", "30")),
        "chat": int(os.getenv("FREE_CHAT_MESSAGES_PER_MONTH", "50")),
    },
    "pro": {
        "receipts": int(os.getenv("PRO_RECEIPTS_PER_MONTH", "500")),
        "chat": int(os.getenv("PRO_CHAT_MESSAGES_PER_MONTH", "2000")),
    },
}

# ── Observability (Application Insights; disabled when empty) ─────────────────
APPLICATIONINSIGHTS_CONNECTION_STRING: str = os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING", "")

# ── CORS (comma-separated origins; empty = allow all, no credentials combo) ───
CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")

# ── Rate limits (per client IP per minute; 0 = disabled) ──────────────────────
RATE_LIMIT_REGISTER_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_REGISTER_PER_MINUTE", "10"))
RATE_LIMIT_LOGIN_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_LOGIN_PER_MINUTE", "20"))
RATE_LIMIT_UPLOAD_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_UPLOAD_PER_MINUTE", "30"))
RATE_LIMIT_CHAT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_CHAT_PER_MINUTE", "60"))
