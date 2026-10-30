"""FastAPI application factory and startup configuration."""

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import APPLICATIONINSIGHTS_CONNECTION_STRING, CORS_ORIGINS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)

# Must run before FastAPI/DB modules load so requests, SQL and logs are instrumented.
if APPLICATIONINSIGHTS_CONNECTION_STRING:
    from azure.monitor.opentelemetry import configure_azure_monitor

    configure_azure_monitor(logger_name="app")

from app.api.v1 import chat as chat_router  # noqa: E402
from app.api.v1 import receipts as receipts_router  # noqa: E402
from app.api.v1 import users as users_router  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.services import upload_service  # noqa: E402


def _resume_stale_receipts() -> None:
    ids = upload_service.claim_stale_receipts()
    if ids:
        log.info("Resuming %d receipts left in processing", len(ids))
    for receipt_id in ids:
        upload_service.process_receipt(receipt_id)


@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=_resume_stale_receipts, daemon=True).start()
    yield


app = FastAPI(
    title="Bel War'a API",
    description="Receipt extraction, spending history and assistant API.",
    version="0.2.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Explicit origins when set (with credentials); otherwise open CORS without credentials.
_origins = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=bool(_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router.router)
app.include_router(receipts_router.router)
app.include_router(users_router.router)


@app.get("/health", include_in_schema=False)
def health():
    """Liveness probe for Azure Container Apps."""
    return {"status": "ok"}
