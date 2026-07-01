"""Video generation. Provider-switchable via VIDEO_GEN_PROVIDER."""

from __future__ import annotations

import time
from typing import Any

import httpx

from ..celery_app import celery_app
from ..config import settings
from ..storage import upload_bytes
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.video.generate", bind=True, max_retries=1, default_retry_delay=30)
def generate_video(
    self,  # noqa: ANN001
    *,
    job_id: str,
    prompt: str,
    duration_ms: int = 4000,
    seed_asset_id: str | None = None,
    width: int = 768,
    height: int = 1344,
    output_key_prefix: str,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "video_generate") as report:
        provider = settings.video_gen_provider
        report(0.1, f"provider={provider}")

        if provider == "runway":
            data = _gen_runway(prompt, duration_ms, width, height, report)
            mime = "video/mp4"
            ext = "mp4"
        elif provider == "pika":
            data = _gen_pika(prompt, duration_ms, width, height, report)
            mime = "video/mp4"
            ext = "mp4"
        elif provider == "replicate":
            data = _gen_replicate(prompt, duration_ms, width, height, report)
            mime = "video/mp4"
            ext = "mp4"
        else:
            raise RuntimeError(f"Video generation is disabled or provider unsupported: {provider}")

        report(0.85, "uploading")
        key = f"{output_key_prefix}/gen_{int(time.time())}.{ext}"
        upload_bytes("generated", key, data, content_type=mime)
        out = {"bucket": "generated", "key": key, "sizeBytes": len(data)}
        succeed(job_id, out)
        return out


def _gen_runway(prompt, duration_ms, width, height, report) -> bytes:  # noqa: ANN001
    if not settings.runway_api_key:
        raise RuntimeError("RUNWAY_API_KEY is required")
    headers = {"Authorization": f"Bearer {settings.runway_api_key}", "Content-Type": "application/json"}
    payload = {
        "promptText": prompt,
        "duration": max(2, duration_ms // 1000),
        "ratio": f"{width}:{height}",
    }
    task = httpx.post(
        "https://api.runwayml.com/v1/image_to_video",
        headers=headers,
        json=payload,
        timeout=60.0,
    )
    task.raise_for_status()
    task_id = task.json()["id"]
    while True:
        time.sleep(3)
        status = httpx.get(
            f"https://api.runwayml.com/v1/tasks/{task_id}",
            headers=headers,
            timeout=30.0,
        ).json()
        report(0.4, f"runway:{status.get('status')}")
        if status.get("status") == "SUCCEEDED":
            url = status["output"][0]
            return httpx.get(url, timeout=120.0).content
        if status.get("status") in ("FAILED", "CANCELED"):
            raise RuntimeError(f"Runway task failed: {status.get('failure')}")


def _gen_pika(prompt, duration_ms, width, height, report) -> bytes:  # noqa: ANN001
    if not settings.pika_api_key:
        raise RuntimeError("PIKA_API_KEY is required")
    headers = {"Authorization": f"Bearer {settings.pika_api_key}", "Content-Type": "application/json"}
    submit = httpx.post(
        "https://api.pika.art/v1/generate",
        headers=headers,
        json={"prompt": prompt, "aspect_ratio": f"{width}:{height}", "duration": duration_ms // 1000},
        timeout=60.0,
    )
    submit.raise_for_status()
    job_id = submit.json()["id"]
    while True:
        time.sleep(3)
        st = httpx.get(f"https://api.pika.art/v1/generate/{job_id}", headers=headers, timeout=30.0).json()
        report(0.4, f"pika:{st.get('status')}")
        if st.get("status") == "completed":
            return httpx.get(st["video_url"], timeout=120.0).content
        if st.get("status") in ("failed", "canceled"):
            raise RuntimeError(f"Pika task failed: {st.get('error')}")


def _gen_replicate(prompt, duration_ms, width, height, report) -> bytes:  # noqa: ANN001
    if not settings.replicate_api_token:
        raise RuntimeError("REPLICATE_API_TOKEN is required")
    headers = {"Authorization": f"Bearer {settings.replicate_api_token}", "Content-Type": "application/json"}
    res = httpx.post(
        "https://api.replicate.com/v1/predictions",
        headers=headers,
        json={
            "version": "stability-ai/stable-video-diffusion",
            "input": {"prompt": prompt, "num_frames": max(14, duration_ms // 100), "sizing_strategy": "maintain_aspect_ratio"},
        },
        timeout=30.0,
    )
    res.raise_for_status()
    pred = res.json()
    while pred["status"] not in ("succeeded", "failed", "canceled"):
        time.sleep(2)
        report(0.4, f"replicate:{pred['status']}")
        pred = httpx.get(pred["urls"]["get"], headers=headers, timeout=30.0).json()
    if pred["status"] != "succeeded":
        raise RuntimeError(f"replicate failed: {pred.get('error')}")
    output = pred.get("output")
    url = output[0] if isinstance(output, list) else output
    return httpx.get(url, timeout=180.0).content
