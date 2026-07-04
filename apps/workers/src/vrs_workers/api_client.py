"""Internal client for calling back into the API server. Used to mark
AiJob rows as running/succeeded/failed without bypassing the API's
domain logic."""

from __future__ import annotations

from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import settings
from .logging import logger


_client = httpx.Client(
    base_url=settings.api_url,
    timeout=httpx.Timeout(15.0, connect=5.0),
    headers={"x-internal-service-token": settings.internal_service_token},
)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def update_job(
    job_id: str,
    *,
    status: str,
    progress: float | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    body: dict[str, Any] = {"status": status}
    if progress is not None:
        body["progress"] = progress
    if result is not None:
        body["resultJson"] = result
    if error is not None:
        body["errorMessage"] = error

    res = _client.patch(f"/v1/internal/jobs/{job_id}", json=body)
    if res.status_code >= 400:
        logger.error("api.update_job_failed", job_id=job_id, status=res.status_code, body=res.text)
        res.raise_for_status()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def asset_done(
    asset_id: str,
    *,
    s3_bucket: str,
    s3_key: str,
    mime_type: str,
    size_bytes: int,
    duration_ms: int | None = None,
    width: int | None = None,
    height: int | None = None,
    fps: float | None = None,
) -> None:
    """Mark an Asset READY after its file landed in storage.

    Without this call the Asset stays PROCESSING with an empty s3Key and
    can never be attached to a timeline or ranking candidate.
    """
    res = _client.post(
        f"/v1/internal/assets/{asset_id}/done",
        json={
            "s3Bucket": s3_bucket,
            "s3Key": s3_key,
            "mimeType": mime_type,
            "sizeBytes": size_bytes,
            "durationMs": duration_ms,
            "width": width,
            "height": height,
            "fps": fps,
        },
    )
    if res.status_code >= 400:
        logger.error("api.asset_done_failed", asset_id=asset_id, status=res.status_code, body=res.text)
        res.raise_for_status()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def asset_thumbnail(asset_id: str, *, key: str) -> None:
    """Record a generated poster frame on the Asset (public bucket key)."""
    res = _client.post(f"/v1/internal/assets/{asset_id}/thumbnail", json={"key": key})
    if res.status_code >= 400:
        logger.error(
            "api.asset_thumbnail_failed", asset_id=asset_id, status=res.status_code, body=res.text
        )
        res.raise_for_status()
