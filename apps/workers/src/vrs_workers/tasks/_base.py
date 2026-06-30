"""Shared task lifecycle helpers.

`run_job` wraps every task in a uniform try/except so we always:
  - transition the AiJob to RUNNING with progress publishing,
  - capture the result or error,
  - publish a terminal status event to Redis pubsub for the WebSocket layer.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Callable, Iterator

from .. import api_client
from ..logging import logger
from ..progress import publish


@contextmanager
def job_lifecycle(job_id: str, kind: str) -> Iterator[Callable[[float, str | None], None]]:
    publish(job_id, status="RUNNING", progress=0.0, message=f"started:{kind}")
    try:
        api_client.update_job(job_id, status="RUNNING", progress=0.0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("job.api_update_failed", job_id=job_id, error=str(exc))

    def report(progress: float, message: str | None = None) -> None:
        publish(job_id, status="RUNNING", progress=progress, message=message)
        try:
            api_client.update_job(job_id, status="RUNNING", progress=progress)
        except Exception as exc:  # noqa: BLE001
            logger.debug("job.api_progress_failed", job_id=job_id, error=str(exc))

    try:
        yield report
    except Exception as exc:  # noqa: BLE001 — top-level boundary
        logger.exception("job.failed", job_id=job_id, kind=kind)
        publish(job_id, status="FAILED", progress=1.0, error=str(exc))
        try:
            api_client.update_job(job_id, status="FAILED", error=str(exc))
        except Exception:
            pass
        raise


def succeed(job_id: str, result: dict[str, Any]) -> None:
    publish(job_id, status="SUCCEEDED", progress=1.0, result=result)
    try:
        api_client.update_job(job_id, status="SUCCEEDED", progress=1.0, result=result)
    except Exception as exc:  # noqa: BLE001
        logger.warning("job.api_final_failed", job_id=job_id, error=str(exc))
