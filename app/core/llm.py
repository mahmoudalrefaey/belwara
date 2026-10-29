"""Azure OpenAI client (v1 API) and per-call token usage recording."""

import logging

from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    LLM_MAX_RETRIES,
    LLM_TIMEOUT_SECONDS,
)
from app.models.usage import LlmUsage

log = logging.getLogger(__name__)


def _api_key():
    """API key when configured; otherwise an Entra ID token provider (managed identity)."""
    if AZURE_OPENAI_API_KEY:
        return AZURE_OPENAI_API_KEY
    from azure.identity import DefaultAzureCredential, get_bearer_token_provider

    return get_bearer_token_provider(
        DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
    )


client = OpenAI(
    base_url=f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/v1/",
    api_key=_api_key(),
    timeout=LLM_TIMEOUT_SECONDS,
    max_retries=LLM_MAX_RETRIES,
)


def record_usage(db: Session, *, user_id: int, kind: str, deployment: str, usage) -> None:
    """Add one usage row (caller commits) and log it. `usage` is the SDK's response.usage."""
    if usage is None:
        return
    log.info(
        "llm_usage kind=%s deployment=%s input_tokens=%s output_tokens=%s",
        kind, deployment, usage.prompt_tokens, usage.completion_tokens,
    )
    db.add(
        LlmUsage(
            user_id=user_id,
            kind=kind,
            deployment=deployment,
            input_tokens=usage.prompt_tokens or 0,
            output_tokens=usage.completion_tokens or 0,
        )
    )
