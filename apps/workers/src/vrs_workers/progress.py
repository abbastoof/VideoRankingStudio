"""Job progress events. Workers publish to Redis pubsub; the API server
subscribes and forwards to connected WebSocket clients."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import redis

from .config import settings
from .logging import logger

_redis = redis.from_url(settings.redis_url, decode_responses=True)

CHANNEL = "vrs:job:{job_id}"


def publish(
    job_id: str,
    *,
    status: str,
    progress: float = 0.0,
    message: str | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    payload = {
        "jobId": job_id,
        "status": status,
        "progress": max(0.0, min(1.0, progress)),
        "message": message,
        "resultJson": result,
        "errorMessage": error,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        _redis.publish(CHANNEL.format(job_id=job_id), json.dumps(payload))
    except Exception as exc:  # noqa: BLE001 — publishing must never break the task
        logger.warning("progress.publish_failed", job_id=job_id, error=str(exc))
