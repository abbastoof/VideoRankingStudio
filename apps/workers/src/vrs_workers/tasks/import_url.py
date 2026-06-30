"""URL import. Fetches a video via yt-dlp and uploads it to S3 as an Asset."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from ..celery_app import celery_app
from ..config import settings
from ..storage import upload_file
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.import.url", bind=True, max_retries=2, default_retry_delay=30)
def import_from_url(
    self,  # noqa: ANN001
    *,
    job_id: str,
    asset_id: str,
    url: str,
    audio_only: bool = False,
    output_key_prefix: str,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "import_url") as report:
        tmp = Path(tempfile.mkdtemp(prefix="vrs-import-"))
        try:
            report(0.1, "starting download")
            cmd = [
                settings.yt_dlp_binary,
                url,
                "-o", str(tmp / "source.%(ext)s"),
                "--no-playlist",
                "--restrict-filenames",
                "--write-info-json",
                "--no-warnings",
                "--quiet",
                "--progress",
            ]
            if audio_only:
                cmd += ["-x", "--audio-format", "mp3"]
            else:
                cmd += ["-f", "bv*+ba/b", "--merge-output-format", "mp4"]
            if settings.yt_dlp_proxy:
                cmd += ["--proxy", settings.yt_dlp_proxy]
            subprocess.run(cmd, check=True)

            # Find the produced media file (yt-dlp picks the extension).
            media = next((p for p in tmp.iterdir() if p.suffix in {".mp4", ".mkv", ".mp3", ".m4a", ".webm"}), None)
            if media is None:
                raise RuntimeError("yt-dlp produced no media file")

            info_path = next(tmp.glob("*.info.json"), None)
            info: dict[str, Any] = {}
            if info_path and info_path.exists():
                info = json.loads(info_path.read_text())

            report(0.7, "uploading to storage")
            key = f"{output_key_prefix}/{asset_id}{media.suffix}"
            content_type = _content_type_for(media.suffix)
            upload_file("uploads", key, media, content_type=content_type)

            result = {
                "assetId": asset_id,
                "s3Bucket": "uploads",
                "s3Key": key,
                "mimeType": content_type,
                "sizeBytes": media.stat().st_size,
                "durationMs": int((info.get("duration") or 0) * 1000),
                "width": info.get("width"),
                "height": info.get("height"),
                "fps": info.get("fps"),
                "title": info.get("title"),
                "uploader": info.get("uploader"),
            }
            succeed(job_id, result)
            return result
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


def _content_type_for(suffix: str) -> str:
    return {
        ".mp4": "video/mp4",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
    }.get(suffix, "application/octet-stream")
