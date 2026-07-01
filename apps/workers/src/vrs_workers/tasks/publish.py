"""Publish workers — push a finished export to a social platform.

The task shape is uniform:
    kwargs = {publish_job_id, target_id, export_id, s3_bucket, s3_key,
              title, description, tags, privacy}

Each provider function returns a `provider_video_id` and public URL. On
success we post `/internal/publish-jobs/:id/done` with `PUBLISHED`; on
failure we post it with `FAILED` and the error message. That keeps the
API's PublishJob row in sync without giving the worker DB write access.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from ..celery_app import celery_app
from ..config import settings
from ..logging import logger
from ..storage import download_tempfile
from ._base import job_lifecycle, succeed


def _fetch_target(target_id: str) -> dict[str, Any]:
    res = httpx.get(
        f"{settings.api_url}/v1/internal/publish-targets/{target_id}",
        headers={"x-internal-service-token": settings.internal_service_token},
        timeout=15.0,
    )
    res.raise_for_status()
    return res.json()


def _report_done(
    publish_job_id: str,
    *,
    status: str,
    provider_video_id: str | None = None,
    provider_url: str | None = None,
    error_message: str | None = None,
) -> None:
    try:
        httpx.post(
            f"{settings.api_url}/v1/internal/publish-jobs/{publish_job_id}/done",
            headers={"x-internal-service-token": settings.internal_service_token},
            json={
                "status": status,
                "providerVideoId": provider_video_id,
                "providerUrl": provider_url,
                "errorMessage": error_message,
            },
            timeout=15.0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("publish.callback_failed", error=str(exc), publish_job_id=publish_job_id)


# ─── YouTube ────────────────────────────────────────────────────────

@celery_app.task(name="vrs.publish.youtube", bind=True, max_retries=2, default_retry_delay=60)
def publish_youtube(
    self,  # noqa: ANN001
    *,
    job_id: str,
    publish_job_id: str,
    target_id: str,
    export_id: str,  # noqa: ARG001
    s3_bucket: str,
    s3_key: str,
    title: str,
    description: str,
    tags: list[str],
    privacy: str,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "publish_youtube") as report:
        try:
            target = _fetch_target(target_id)
            report(0.1, "downloading export")
            with download_tempfile(s3_bucket, s3_key, suffix=".mp4") as local:  # type: ignore[arg-type]
                report(0.35, "uploading to YouTube")
                video_id = _youtube_resumable_upload(
                    target["accessToken"],
                    local,
                    title=title,
                    description=description,
                    tags=tags,
                    privacy_status=_yt_privacy(privacy),
                    report=report,
                )
            url = f"https://youtube.com/watch?v={video_id}"
            _report_done(publish_job_id, status="PUBLISHED", provider_video_id=video_id, provider_url=url)
            out = {"videoId": video_id, "url": url}
            succeed(job_id, out)
            return out
        except Exception as exc:
            _report_done(publish_job_id, status="FAILED", error_message=str(exc))
            raise


def _yt_privacy(v: str) -> str:
    return {"public": "public", "unlisted": "unlisted", "private": "private"}.get(v, "unlisted")


def _youtube_resumable_upload(
    access_token: str,
    file_path: Path,
    *,
    title: str,
    description: str,
    tags: list[str],
    privacy_status: str,
    report,  # noqa: ANN001
) -> str:
    """YouTube Data API v3 resumable upload."""
    metadata = {
        "snippet": {"title": title, "description": description, "tags": tags, "categoryId": "22"},
        "status": {"privacyStatus": privacy_status, "selfDeclaredMadeForKids": False},
    }
    size = file_path.stat().st_size
    session_res = httpx.post(
        "https://www.googleapis.com/upload/youtube/v3/videos"
        "?uploadType=resumable&part=snippet,status",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": str(size),
            "X-Upload-Content-Type": "video/mp4",
        },
        json=metadata,
        timeout=30.0,
    )
    if session_res.status_code >= 400:
        raise RuntimeError(f"YouTube session init failed: {session_res.text}")
    upload_url = session_res.headers["Location"]

    chunk_size = 4 * 1024 * 1024
    uploaded = 0
    with file_path.open("rb") as fh:
        while uploaded < size:
            chunk = fh.read(chunk_size)
            end = uploaded + len(chunk) - 1
            r = httpx.put(
                upload_url,
                content=chunk,
                headers={
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {uploaded}-{end}/{size}",
                    "Content-Type": "video/mp4",
                },
                timeout=180.0,
            )
            if r.status_code in (200, 201):
                data = r.json()
                return data["id"]
            if r.status_code != 308:
                raise RuntimeError(f"YouTube upload failed at byte {uploaded}: {r.status_code} {r.text}")
            uploaded = end + 1
            report(0.35 + 0.55 * (uploaded / max(size, 1)))
    raise RuntimeError("YouTube upload finished without a video id")


# ─── TikTok ────────────────────────────────────────────────────────

@celery_app.task(name="vrs.publish.tiktok", bind=True, max_retries=2, default_retry_delay=60)
def publish_tiktok(
    self,  # noqa: ANN001
    *,
    job_id: str,
    publish_job_id: str,
    target_id: str,
    export_id: str,  # noqa: ARG001
    s3_bucket: str,
    s3_key: str,
    title: str,
    description: str,  # noqa: ARG001
    tags: list[str],  # noqa: ARG001
    privacy: str,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "publish_tiktok") as report:
        try:
            target = _fetch_target(target_id)
            report(0.1, "initiating TikTok upload")
            with download_tempfile(s3_bucket, s3_key, suffix=".mp4") as local:  # type: ignore[arg-type]
                video_id = _tiktok_upload(
                    target["accessToken"],
                    local,
                    title=title,
                    privacy=privacy,
                    report=report,
                )
            url = f"https://www.tiktok.com/@me/video/{video_id}"
            _report_done(publish_job_id, status="PUBLISHED", provider_video_id=video_id, provider_url=url)
            out = {"videoId": video_id, "url": url}
            succeed(job_id, out)
            return out
        except Exception as exc:
            _report_done(publish_job_id, status="FAILED", error_message=str(exc))
            raise


def _tiktok_upload(access_token: str, file_path: Path, *, title: str, privacy: str, report) -> str:  # noqa: ANN001
    """TikTok Content Posting API — direct post with FILE_UPLOAD source."""
    size = file_path.stat().st_size
    chunk_size = 10 * 1024 * 1024
    chunk_count = max(1, (size + chunk_size - 1) // chunk_size)

    init_res = httpx.post(
        "https://open.tiktokapis.com/v2/post/publish/video/init/",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
        },
        json={
            "post_info": {
                "title": title[:2200],
                "privacy_level": {
                    "public": "PUBLIC_TO_EVERYONE",
                    "unlisted": "MUTUAL_FOLLOW_FRIENDS",
                    "private": "SELF_ONLY",
                }.get(privacy, "SELF_ONLY"),
                "disable_duet": False,
                "disable_stitch": False,
                "disable_comment": False,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": size,
                "chunk_size": chunk_size,
                "total_chunk_count": chunk_count,
            },
        },
        timeout=30.0,
    )
    if init_res.status_code >= 400:
        raise RuntimeError(f"TikTok init failed: {init_res.text}")
    init = init_res.json()["data"]
    upload_url = init["upload_url"]
    publish_id = init["publish_id"]

    uploaded = 0
    with file_path.open("rb") as fh:
        for i in range(chunk_count):
            chunk = fh.read(chunk_size)
            end = uploaded + len(chunk) - 1
            r = httpx.put(
                upload_url,
                content=chunk,
                headers={
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {uploaded}-{end}/{size}",
                    "Content-Type": "video/mp4",
                },
                timeout=180.0,
            )
            if r.status_code not in (200, 201, 202):
                raise RuntimeError(f"TikTok chunk {i} failed: {r.status_code} {r.text}")
            uploaded = end + 1
            report(0.15 + 0.75 * (uploaded / max(size, 1)))
    # Publish id doubles as the video id we surface to the user.
    return publish_id
