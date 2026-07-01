"""Voice-clone training. Transcodes user-provided samples to a uniform
mono-16k format, submits them to the configured provider, and updates the
Voice row with the new provider voice id when training finishes."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import httpx

from ..celery_app import celery_app
from ..config import settings
from ..logging import logger
from ..storage import download_tempfile
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.voice.clone", bind=True, max_retries=1, default_retry_delay=60)
def train_voice(
    self,  # noqa: ANN001
    *,
    job_id: str,
    voice_id: str,
    sample_asset_ids: list[str],
    voice_name: str,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "voice_clone") as report:
        report(0.05, f"fetching {len(sample_asset_ids)} sample(s)")
        work = Path(tempfile.mkdtemp(prefix=f"vrs-clone-{voice_id}-"))
        try:
            prepared: list[Path] = []
            for i, asset_id in enumerate(sample_asset_ids):
                # Ask the API for the S3 key so we can download it directly.
                info = _fetch_asset_ref(asset_id)
                if not info:
                    continue
                with download_tempfile(info["bucket"], info["key"], suffix=Path(info["key"]).suffix) as raw:
                    transcoded = work / f"sample_{i}.wav"
                    _transcode_for_cloning(raw, transcoded)
                    prepared.append(transcoded)
                report(0.15 + 0.35 * (i + 1) / max(len(sample_asset_ids), 1))

            if not prepared:
                raise RuntimeError("No usable samples for voice cloning")

            report(0.55, "submitting to provider")
            if settings.tts_provider == "elevenlabs":
                provider_voice_id = _clone_elevenlabs(voice_name, prepared)
                provider = "ELEVENLABS"
            else:
                raise RuntimeError(f"Voice cloning not implemented for provider: {settings.tts_provider}")

            report(0.9, "finalising")
            _post_voice_ready(voice_id, provider, provider_voice_id)

            out = {"voiceId": voice_id, "provider": provider, "providerVoiceId": provider_voice_id}
            succeed(job_id, out)
            return out
        finally:
            shutil.rmtree(work, ignore_errors=True)


def _fetch_asset_ref(asset_id: str) -> dict[str, str] | None:
    """Ask the API's internal lookup for an asset's bucket+key. We reuse the
    timeline internal channel here rather than open a new dedicated endpoint;
    if this becomes a hot path we'll split it out."""
    headers = {"x-internal-service-token": settings.internal_service_token}
    try:
        res = httpx.get(
            f"{settings.api_url}/v1/internal/assets/{asset_id}",
            headers=headers,
            timeout=15.0,
        )
        if res.status_code == 404:
            return None
        res.raise_for_status()
        data = res.json()
        return {"bucket": data["s3Bucket"], "key": data["s3Key"]}
    except Exception as exc:  # noqa: BLE001
        logger.warning("voice_clone.asset_lookup_failed", asset_id=asset_id, error=str(exc))
        return None


def _transcode_for_cloning(src: Path, dest: Path) -> None:
    """Mono, 22050 Hz, 16-bit PCM — a safe common denominator across cloning
    providers. We also trim ambient silence at both ends so short recordings
    don't get charged for empty time."""
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src),
            "-ac", "1",
            "-ar", "22050",
            "-af",
            "silenceremove=start_periods=1:start_silence=0.2:start_threshold=-45dB:"
            "stop_periods=-1:stop_silence=0.4:stop_threshold=-45dB",
            "-c:a", "pcm_s16le",
            str(dest),
        ],
        check=True,
    )


def _clone_elevenlabs(name: str, samples: list[Path]) -> str:
    if not settings.elevenlabs_api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is required for voice cloning")
    files = [("files", (p.name, p.open("rb"), "audio/wav")) for p in samples]
    try:
        res = httpx.post(
            "https://api.elevenlabs.io/v1/voices/add",
            headers={"xi-api-key": settings.elevenlabs_api_key},
            data={"name": name},
            files=files,
            timeout=180.0,
        )
        res.raise_for_status()
    finally:
        for _, (_, fh, _) in files:
            fh.close()
    return res.json()["voice_id"]


def _post_voice_ready(voice_id: str, provider: str, provider_voice_id: str) -> None:
    headers = {"x-internal-service-token": settings.internal_service_token}
    try:
        httpx.post(
            f"{settings.api_url}/v1/internal/voices/{voice_id}/trained",
            headers=headers,
            json={"provider": provider, "providerVoiceId": provider_voice_id},
            timeout=15.0,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("voice_clone.callback_failed", error=str(exc))
