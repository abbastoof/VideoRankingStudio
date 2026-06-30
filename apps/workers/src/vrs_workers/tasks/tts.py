"""Text-to-speech task. Routes to the configured provider; returns S3 key
for the generated audio file."""

from __future__ import annotations

from typing import Any

from ..celery_app import celery_app
from ..config import settings
from ..storage import upload_bytes
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.tts.generate", bind=True, max_retries=2, default_retry_delay=15)
def generate_voiceover(
    self,  # noqa: ANN001
    *,
    job_id: str,
    voiceover_id: str,
    voice_provider: str,
    provider_voice_id: str,
    script_text: str,
    output_key_prefix: str,
    speed: float = 1.0,
    pitch: float = 0.0,
    stability: float | None = None,
    similarity_boost: float | None = None,
    style: dict[str, Any] | None = None,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "tts") as report:
        report(0.1, f"provider={voice_provider}")

        if voice_provider == "ELEVENLABS":
            audio = _tts_elevenlabs(
                provider_voice_id,
                script_text,
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
            )
            mime = "audio/mpeg"
            ext = "mp3"
        elif voice_provider == "POLLY":
            audio = _tts_polly(provider_voice_id, script_text, speed=speed)
            mime = "audio/mpeg"
            ext = "mp3"
        elif voice_provider == "AZURE":
            audio = _tts_azure(provider_voice_id, script_text, speed=speed, pitch=pitch)
            mime = "audio/mpeg"
            ext = "mp3"
        else:
            raise RuntimeError(f"Unsupported TTS provider: {voice_provider}")

        report(0.7, "uploading audio")
        key = f"{output_key_prefix}/{voiceover_id}.{ext}"
        upload_bytes("generated", key, audio, content_type=mime)

        out = {
            "audioBucket": "generated",
            "audioKey": key,
            "sizeBytes": len(audio),
            "charactersUsed": len(script_text),
        }
        succeed(job_id, out)
        return out


def _tts_elevenlabs(voice_id: str, text: str, *, stability, similarity_boost, style) -> bytes:  # noqa: ANN001
    if not settings.elevenlabs_api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is required for ELEVENLABS provider")

    import httpx

    voice_settings: dict[str, Any] = {}
    if stability is not None:
        voice_settings["stability"] = stability
    if similarity_boost is not None:
        voice_settings["similarity_boost"] = similarity_boost
    if style:
        voice_settings.update(style)

    body = {"text": text, "model_id": "eleven_multilingual_v2"}
    if voice_settings:
        body["voice_settings"] = voice_settings

    res = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={
            "xi-api-key": settings.elevenlabs_api_key,
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=120.0,
    )
    res.raise_for_status()
    return res.content


def _tts_polly(voice_id: str, text: str, *, speed: float) -> bytes:  # noqa: ANN001
    import boto3

    polly = boto3.client("polly", region_name=settings.s3_region)
    # SSML for speed control
    rate_pct = max(20, min(200, int(speed * 100)))
    ssml = f'<speak><prosody rate="{rate_pct}%">{text}</prosody></speak>'
    res = polly.synthesize_speech(
        Text=ssml, TextType="ssml", VoiceId=voice_id, OutputFormat="mp3", Engine="neural"
    )
    return res["AudioStream"].read()


def _tts_azure(voice_id: str, text: str, *, speed: float, pitch: float) -> bytes:  # noqa: ANN001
    # Implementation hook — requires AZURE_SPEECH_KEY / AZURE_SPEECH_REGION envs
    # and azure-cognitiveservices-speech package. Left as a configurable
    # extension; Polly + ElevenLabs cover most production cases.
    raise NotImplementedError("Azure TTS adapter pending configuration; use ELEVENLABS or POLLY")
