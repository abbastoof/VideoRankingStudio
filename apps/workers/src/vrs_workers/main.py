"""FastAPI admin server for the worker pool.

Surfaces /health, /ready, /metrics, and a small introspection API for queue
depth. The actual job execution is Celery; this process just exposes the
control plane on a port that orchestrators (ECS, K8s) can probe."""

from __future__ import annotations

import os
import time

from fastapi import FastAPI

from .celery_app import celery_app
from .config import settings
from .logging import configure_logging, logger

configure_logging()
logger.info("workers.boot", env=settings.node_env, broker=settings.broker_url)

app = FastAPI(
    title="VideoRankingStudio Workers",
    description="Control-plane for the AI worker pool.",
    version="0.1.0",
)

START_TIME = time.time()


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "workers"}


@app.get("/health/ready", tags=["health"])
def ready() -> dict[str, object]:
    checks: dict[str, dict[str, object]] = {}
    overall = "ok"
    try:
        insp = celery_app.control.inspect(timeout=2.0)
        pinged = insp.ping() or {}
        checks["broker"] = {"status": "ok", "workers": list(pinged.keys())}
    except Exception as exc:  # noqa: BLE001
        checks["broker"] = {"status": "fail", "error": str(exc)}
        overall = "degraded"
    return {
        "status": overall,
        "version": os.getenv("GIT_SHA", "dev"),
        "uptime": time.time() - START_TIME,
        "checks": checks,
    }


@app.get("/queues", tags=["introspection"])
def queues() -> dict[str, object]:
    insp = celery_app.control.inspect(timeout=2.0)
    return {
        "active": insp.active() or {},
        "reserved": insp.reserved() or {},
        "scheduled": insp.scheduled() or {},
        "stats": insp.stats() or {},
    }


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"name": "VideoRankingStudio Workers", "version": "0.1.0"}
