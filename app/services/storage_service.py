"""Original receipt files: Azure Blob Storage when configured, local folder otherwise (dev)."""

import uuid
from functools import lru_cache
from pathlib import Path

from app.config import (
    AZURE_STORAGE_ACCOUNT_URL,
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_CONTAINER,
    RECEIPTS_IMG_DIR,
)

_LOCAL_DIR = Path(RECEIPTS_IMG_DIR)
_USE_BLOB = bool(AZURE_STORAGE_ACCOUNT_URL or AZURE_STORAGE_CONNECTION_STRING)


@lru_cache(maxsize=1)
def _container():
    from azure.core.exceptions import ResourceExistsError
    from azure.storage.blob import BlobServiceClient

    if AZURE_STORAGE_ACCOUNT_URL:
        from azure.identity import DefaultAzureCredential

        service = BlobServiceClient(AZURE_STORAGE_ACCOUNT_URL, credential=DefaultAzureCredential())
    else:
        service = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    container = service.get_container_client(AZURE_STORAGE_CONTAINER)
    if not container.exists():
        try:
            container.create_container()
        except ResourceExistsError:  # created concurrently by another replica
            pass
    return container


def save(user_id: int, data: bytes, ext: str) -> str:
    """Store bytes under a new key `{user_id}/{uuid}{ext}` and return the key."""
    key = f"{user_id}/{uuid.uuid4().hex}{ext.lower()}"
    if _USE_BLOB:
        _container().upload_blob(key, data)
    else:
        path = _LOCAL_DIR / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return key


def load(key: str) -> bytes:
    if _USE_BLOB:
        return _container().download_blob(key).readall()
    return (_LOCAL_DIR / key).read_bytes()


def delete(key: str) -> None:
    """Best-effort delete; a missing file is not an error."""
    if _USE_BLOB:
        from azure.core.exceptions import ResourceNotFoundError

        try:
            _container().delete_blob(key)
        except ResourceNotFoundError:
            pass
    else:
        (_LOCAL_DIR / key).unlink(missing_ok=True)
