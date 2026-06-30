"""Image generation. Stability or Replicate today; SDXL local for self-host."""

from __future__ import annotations

from typing import Any

import httpx

from ..celery_app import celery_app
from ..config import settings
from ..storage import upload_bytes
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.image.generate", bind=True, max_retries=2)
def generate_image(
    self,  # noqa: ANN001
    *,
    job_id: str,
    asset_id_prefix: str,
    prompt: str,
    negative_prompt: str | None = None,
    width: int = 1024,
    height: int = 1024,
    count: int = 1,
    output_key_prefix: str,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "image_generate") as report:
        report(0.15, f"provider={settings.image_provider}")

        if settings.image_provider == "stability":
            images = _gen_stability(prompt, negative_prompt, width, height, count, report)
        elif settings.image_provider == "replicate":
            images = _gen_replicate(prompt, negative_prompt, width, height, count, report)
        else:
            raise RuntimeError(f"Unsupported IMAGE_PROVIDER: {settings.image_provider}")

        report(0.85, "uploading")
        out_keys: list[str] = []
        for i, data in enumerate(images):
            key = f"{output_key_prefix}/{asset_id_prefix}_{i}.png"
            upload_bytes("generated", key, data, content_type="image/png")
            out_keys.append(key)
        result = {"images": [{"key": k, "bucket": "generated"} for k in out_keys]}
        succeed(job_id, result)
        return result


def _gen_stability(prompt, negative_prompt, w, h, n, report) -> list[bytes]:  # noqa: ANN001
    if not settings.stability_api_key:
        raise RuntimeError("STABILITY_API_KEY is required")
    images: list[bytes] = []
    for i in range(n):
        report(0.2 + 0.6 * (i / max(n, 1)), f"stability image {i + 1}/{n}")
        res = httpx.post(
            "https://api.stability.ai/v2beta/stable-image/generate/sd3",
            headers={
                "Authorization": f"Bearer {settings.stability_api_key}",
                "Accept": "image/*",
            },
            files={"none": ""},
            data={
                "prompt": prompt,
                "negative_prompt": negative_prompt or "",
                "output_format": "png",
                "aspect_ratio": _aspect_for(w, h),
            },
            timeout=180.0,
        )
        res.raise_for_status()
        images.append(res.content)
    return images


def _gen_replicate(prompt, negative_prompt, w, h, n, report) -> list[bytes]:  # noqa: ANN001
    if not settings.replicate_api_token:
        raise RuntimeError("REPLICATE_API_TOKEN is required")
    headers = {
        "Authorization": f"Bearer {settings.replicate_api_token}",
        "Content-Type": "application/json",
    }
    res = httpx.post(
        "https://api.replicate.com/v1/predictions",
        headers=headers,
        json={
            "version": "stability-ai/sdxl",
            "input": {
                "prompt": prompt,
                "negative_prompt": negative_prompt or "",
                "width": w,
                "height": h,
                "num_outputs": n,
            },
        },
        timeout=30.0,
    )
    res.raise_for_status()
    pred = res.json()
    poll_url = pred["urls"]["get"]
    while pred["status"] not in ("succeeded", "failed", "canceled"):
        import time
        time.sleep(2)
        report(0.4, f"replicate: {pred['status']}")
        pred = httpx.get(poll_url, headers=headers, timeout=30.0).json()
    if pred["status"] != "succeeded":
        raise RuntimeError(f"replicate failed: {pred.get('error')}")
    out = pred.get("output") or []
    if isinstance(out, str):
        out = [out]
    return [httpx.get(u, timeout=60.0).content for u in out]


def _aspect_for(w: int, h: int) -> str:
    r = w / h
    if abs(r - 9 / 16) < 0.05:
        return "9:16"
    if abs(r - 16 / 9) < 0.05:
        return "16:9"
    if abs(r - 1) < 0.05:
        return "1:1"
    if abs(r - 4 / 5) < 0.05:
        return "4:5"
    return "1:1"
