"""Thumbnail generation: extracts a representative frame and writes a poster."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any

from ..celery_app import celery_app
from ..storage import download_tempfile, upload_file
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.thumbnail.generate", bind=True, max_retries=2)
def generate_thumbnail(
    self,  # noqa: ANN001
    *,
    job_id: str,
    asset_bucket: str,
    asset_key: str,
    output_key: str,
    at_seconds: float = 1.0,
    width: int = 720,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "thumbnail") as report:
        with download_tempfile(asset_bucket, asset_key, suffix=Path(asset_key).suffix) as src:  # type: ignore[arg-type]
            report(0.3, "extracting frame")
            dest = Path(tempfile.mkstemp(suffix=".jpg")[1])
            subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-ss", str(at_seconds), "-i", str(src),
                    "-frames:v", "1",
                    "-vf", f"scale={width}:-2",
                    "-q:v", "3",
                    str(dest),
                ],
                check=True,
            )
            report(0.8, "uploading")
            upload_file("public", output_key, dest, content_type="image/jpeg")
            dest.unlink(missing_ok=True)

        out = {"bucket": "public", "key": output_key}
        succeed(job_id, out)
        return out
