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
