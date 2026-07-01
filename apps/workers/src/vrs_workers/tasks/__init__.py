"""Worker task registry. Each module registers its tasks with the Celery app.

Importing this package via `autodiscover_tasks` is how Celery picks them up."""

from . import (
    transcription,
    tts,
    highlights,
    script_gen,
    image_gen,
    import_url,
    export_render,
    thumbnails,
    video_gen,
    voice_clone,
    publish,
)

__all__ = [
    "transcription",
    "tts",
    "highlights",
    "script_gen",
    "image_gen",
    "import_url",
    "export_render",
    "thumbnails",
    "video_gen",
    "voice_clone",
    "publish",
]
