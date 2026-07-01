"""OpenTelemetry + Sentry initialisation for the worker pool.

Import this module from `main.py` and from `celery_app.py` at boot. Both
integrations are opt-in: they no-op silently when their SDKs are absent or
the relevant env vars aren't set.
"""

from __future__ import annotations

import os

from .config import settings
from .logging import logger

_initialised = False


def init_tracing() -> None:
    global _initialised
    if _initialised:
        return
    _initialised = True

    _init_sentry()
    _init_otel()


def _init_sentry() -> None:
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.sentry_environment,
            release=os.getenv("GIT_SHA"),
            traces_sample_rate=0.1,
            profiles_sample_rate=0.05,
            integrations=[CeleryIntegration(), FastApiIntegration()],
        )
        logger.info("sentry.initialised")
    except Exception as exc:  # noqa: BLE001
        logger.warning("sentry.init_failed", error=str(exc))


def _init_otel() -> None:
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.celery import CeleryInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        resource = Resource.create({
            "service.name": "vrs-workers",
            "service.version": os.getenv("GIT_SHA", "dev"),
            "deployment.environment": settings.node_env,
        })
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces")))
        trace.set_tracer_provider(provider)

        CeleryInstrumentor().instrument()
        HTTPXClientInstrumentor().instrument()
        SQLAlchemyInstrumentor().instrument()
        logger.info("otel.initialised")
    except Exception as exc:  # noqa: BLE001
        logger.warning("otel.init_failed", error=str(exc))


def capture_exception(exc: BaseException, context: dict | None = None) -> None:
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc, extra=context)
    except Exception:  # noqa: BLE001
        pass
