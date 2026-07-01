"""Celery configuration. One app, multiple queues — each routable to its own
worker pool. Promote a queue to a separate deployment without changing code
by editing infrastructure/k8s or the ECS service definition."""

from __future__ import annotations

from celery import Celery
from kombu import Queue

from .config import settings
from .tracing import init_tracing

init_tracing()


def _make_app() -> Celery:
    app = Celery("vrs_workers", broker=settings.broker_url, backend=settings.broker_result_backend)

    app.conf.update(
        timezone="UTC",
        enable_utc=True,
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        task_acks_late=True,
        task_reject_on_worker_lost=True,
        task_track_started=True,
        worker_prefetch_multiplier=1,
        worker_max_tasks_per_child=200,
        broker_connection_retry_on_startup=True,
        result_expires=24 * 3600,
        task_default_queue="default",
        task_queues=(
            Queue("default"),
            Queue("transcription"),
            Queue("tts"),
            Queue("voice_clone"),
            Queue("highlights"),
            Queue("image_gen"),
            Queue("video_gen"),
            Queue("script_gen"),
            Queue("import_url"),
            Queue("export", routing_key="export"),
            Queue("thumbnails"),
            Queue("publish"),
        ),
        task_routes={
            "vrs.transcribe": {"queue": "transcription"},
            "vrs.tts.generate": {"queue": "tts"},
            "vrs.voice.clone": {"queue": "voice_clone"},
            "vrs.highlights.detect": {"queue": "highlights"},
            "vrs.image.generate": {"queue": "image_gen"},
            "vrs.video.generate": {"queue": "video_gen"},
            "vrs.script.generate": {"queue": "script_gen"},
            "vrs.script.rewrite": {"queue": "script_gen"},
            "vrs.import.url": {"queue": "import_url"},
            "vrs.export.render": {"queue": "export"},
            "vrs.thumbnail.generate": {"queue": "thumbnails"},
            "vrs.publish.youtube": {"queue": "publish"},
            "vrs.publish.tiktok": {"queue": "publish"},
        },
    )

    # Autodiscover tasks under the tasks package.
    app.autodiscover_tasks(["vrs_workers.tasks"])
    return app


celery_app = _make_app()
