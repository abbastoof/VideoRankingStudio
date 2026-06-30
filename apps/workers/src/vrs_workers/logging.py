"""structlog configuration. JSON in prod, human-readable in dev."""

from __future__ import annotations

import logging
import sys

import structlog

from .config import settings


def configure_logging() -> None:
    timestamper = structlog.processors.TimeStamper(fmt="iso")
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.StackInfoRenderer(),
        timestamper,
    ]

    if settings.node_env in ("development", "test"):
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, settings.log_level.upper(), logging.INFO)),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


logger = structlog.get_logger("vrs.workers")
