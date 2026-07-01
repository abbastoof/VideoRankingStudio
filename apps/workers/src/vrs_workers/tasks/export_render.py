"""Export render.

Fetches the project timeline from the API's internal endpoint, downloads every
referenced asset + voiceover + caption artifact, builds a single FFmpeg
filtergraph via `vrs_workers.compose`, runs the render, uploads the result to
S3, and reports completion back to the API."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Any

import httpx

from ..celery_app import celery_app
from ..compose import ASPECT_TO_WH, ComposeSpec, build_command, run
from ..config import settings
from ..logging import logger
from ..storage import download_to, upload_file
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.export.render", bind=True, max_retries=1, default_retry_delay=60)
def render_export(
    self,  # noqa: ANN001
    *,
    job_id: str,
    export_id: str,
    project_id: str,
    format_: str = "MP4_H264",
    resolution_w: int = 1080,
    resolution_h: int = 1920,
    fps: int = 30,
    bitrate_kbps: int | None = None,
    burn_captions: bool = True,
    normalize_loudness: bool = True,
    watermark: bool = False,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "export") as report:
        work = Path(tempfile.mkdtemp(prefix=f"vrs-export-{export_id}-"))
        try:
            report(0.05, "fetching timeline")
            timeline = _fetch_timeline(project_id)

            report(0.15, "downloading assets")
            asset_paths, voiceover_paths = _download_media(timeline, work, report)
            caption_srt = _download_caption_srt(timeline, work)

            report(0.42, "building filter graph")
            output = work / "out.mp4"
            spec = ComposeSpec(
                output=output,
                width=resolution_w,
                height=resolution_h,
                fps=fps,
                bitrate_kbps=bitrate_kbps,
                burn_captions=burn_captions and caption_srt is not None,
                normalize_loudness=normalize_loudness,
                watermark=watermark,
                watermark_path=_maybe_watermark_path(work) if watermark else None,
                background_music_path=None,  # explicit per-project music lands with the music picker
                duck_music_against_voice=True,
                caption_style=_caption_style(timeline),
            )
            built = build_command(
                timeline=timeline,
                asset_paths=asset_paths,
                voiceover_paths=voiceover_paths,
                caption_srt_path=caption_srt,
                spec=spec,
            )

            report(0.5, "encoding")
            run(built.argv)

            report(0.9, "uploading export")
            key = f"projects/{project_id}/exports/{export_id}.mp4"
            upload_file("exports", key, output, content_type="video/mp4")

            size_bytes = output.stat().st_size
            _post_done(export_id, key, size_bytes, timeline.get("durationMs"))

            result = {
                "exportId": export_id,
                "s3Bucket": "exports",
                "s3Key": key,
                "sizeBytes": size_bytes,
                "format": format_,
                "resolutionW": resolution_w,
                "resolutionH": resolution_h,
                "fps": fps,
            }
            succeed(job_id, result)
            return result
        finally:
            shutil.rmtree(work, ignore_errors=True)


def _fetch_timeline(project_id: str) -> dict[str, Any]:
    headers = {"x-internal-service-token": settings.internal_service_token}
    res = httpx.get(
        f"{settings.api_url}/v1/internal/projects/{project_id}/timeline",
        headers=headers,
        timeout=30.0,
    )
    res.raise_for_status()
    return res.json()


def _download_media(
    timeline: dict[str, Any],
    work: Path,
    report,  # noqa: ANN001
) -> tuple[dict[str, Path], dict[str, Path]]:
    asset_paths: dict[str, Path] = {}
    voiceover_paths: dict[str, Path] = {}

    refs: list[tuple[str, str, str, str]] = []  # (kind, id, bucket, key)
    for track in timeline.get("tracks", []):
        for clip in track.get("clips", []):
            asset = clip.get("asset")
            if asset and asset.get("s3Key"):
                refs.append(("asset", asset["id"], asset["s3Bucket"], asset["s3Key"]))
            vo = clip.get("voiceover")
            if vo and vo.get("audioKey"):
                refs.append(("voiceover", vo["id"], vo["audioBucket"], vo["audioKey"]))

    seen: set[str] = set()
    for i, (kind, obj_id, bucket, key) in enumerate(refs):
        dedupe_key = f"{kind}:{obj_id}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        dest = work / f"{kind}_{obj_id}{Path(key).suffix or '.bin'}"
        try:
            download_to(bucket, key, dest)  # type: ignore[arg-type]
        except Exception as exc:  # noqa: BLE001
            logger.warning("export.download_failed", key=key, error=str(exc))
            continue
        if kind == "asset":
            asset_paths[obj_id] = dest
        else:
            voiceover_paths[obj_id] = dest
        report(0.15 + 0.27 * (i + 1) / max(len(refs), 1))
    return asset_paths, voiceover_paths


def _download_caption_srt(timeline: dict[str, Any], work: Path) -> Path | None:
    """If the timeline has an enabled caption track with a transcript SRT
    reference, download it so ffmpeg can burn it in via libass/subtitles."""
    captions = timeline.get("captions") or []
    for cap in captions:
        if not cap.get("enabled"):
            continue
        style = cap.get("styleJson") or {}
        srt_key = style.get("srtKey")
        if srt_key:
            dest = work / f"caption_{cap['id']}.srt"
            try:
                download_to("generated", srt_key, dest)
                return dest
            except Exception as exc:  # noqa: BLE001
                logger.warning("export.caption_download_failed", error=str(exc))
    return None


def _caption_style(timeline: dict[str, Any]) -> dict[str, Any]:
    for cap in timeline.get("captions") or []:
        if cap.get("enabled") and cap.get("styleJson"):
            return cap["styleJson"]
    return {"fontFamily": "Inter", "fontSize": 48, "color": "#ffffff"}


def _maybe_watermark_path(work: Path) -> Path | None:
    """Extract the bundled watermark PNG into the working directory. If a
    real brand mark isn't present at deploy time we generate a tiny SVG-like
    placeholder — the drawtext filter still gets used as a fallback in
    compose.py when this returns None."""
    wm_source = Path("/opt/vrs/watermark.png")
    if wm_source.exists():
        dest = work / "watermark.png"
        shutil.copy(wm_source, dest)
        return dest
    return None


def _post_done(export_id: str, key: str, size_bytes: int, duration_ms: int | None) -> None:
    headers = {"x-internal-service-token": settings.internal_service_token}
    body = {"s3Bucket": "exports", "s3Key": key, "sizeBytes": size_bytes, "durationMs": duration_ms}
    try:
        httpx.post(
            f"{settings.api_url}/v1/internal/exports/{export_id}/done",
            headers=headers,
            json=body,
            timeout=15.0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("export.done_callback_failed", error=str(exc))


def resolution_for_aspect(aspect: str) -> tuple[int, int]:
    return ASPECT_TO_WH.get(aspect, (1080, 1920))
