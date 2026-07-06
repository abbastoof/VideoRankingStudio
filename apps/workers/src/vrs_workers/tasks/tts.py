"""Text-to-speech task. Routes to the configured provider; returns S3 key
for the generated audio file."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .. import api_client
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
        elif voice_provider == "INTERNAL":
            # Free offline voice: Windows SAPI locally, espeak-ng in the
            # container. No API key, no per-character cost.
            audio = _tts_internal(script_text, speed=speed)
            mime = "audio/mpeg"
            ext = "mp3"
        else:
            raise RuntimeError(f"Unsupported TTS provider: {voice_provider}")

        report(0.7, "uploading audio")
        key = f"{output_key_prefix}/{voiceover_id}.{ext}"
        upload_bytes("generated", key, audio, content_type=mime)

        duration_ms = _probe_duration_ms(audio, ext)

        report(0.9, "registering voiceover")
        api_client.voiceover_done(
            voiceover_id,
            audio_bucket="generated",
            audio_key=key,
            duration_ms=duration_ms,
            characters_used=len(script_text),
        )

        out = {
            "voiceoverId": voiceover_id,
            "audioBucket": "generated",
            "audioKey": key,
            "sizeBytes": len(audio),
            "durationMs": duration_ms,
            "charactersUsed": len(script_text),
        }
        succeed(job_id, out)
        return out


def _probe_duration_ms(audio: bytes, ext: str) -> int | None:
    """ffprobe the in-memory audio for its duration (best-effort)."""
    # mkstemp returns an OPEN fd — close it via fdopen or Windows will refuse
    # the unlink below (the file counts as in-use by our own process).
    fd, name = tempfile.mkstemp(suffix=f".{ext}")
    tmp = Path(name)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio)
        res = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(tmp),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return int(float(res.stdout.strip()) * 1000)
    except Exception:  # duration is nice-to-have; never fail the job over it
        return None
    finally:
        tmp.unlink(missing_ok=True)


def _tts_internal(text: str, *, speed: float) -> bytes:
    """Offline synthesis → mp3. SAPI on Windows, espeak-ng elsewhere."""
    workdir = Path(tempfile.mkdtemp(prefix="vrs-tts-"))
    wav = workdir / "voice.wav"
    mp3 = workdir / "voice.mp3"
    try:
        if platform.system() == "Windows":
            # SAPI rate is -10..10; map speed 0.5..2.0 → -5..8.
            rate = max(-10, min(10, round((speed - 1.0) * 8)))
            script = (
                "Add-Type -AssemblyName System.Speech; "
                "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                f"$s.Rate = {rate}; "
                f"$s.SetOutputToWaveFile('{wav}'); "
                "$s.Speak([Console]::In.ReadToEnd()); "
                "$s.Dispose()"
            )
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", script],
                input=text,
                text=True,
                check=True,
                capture_output=True,
            )
        else:
            espeak = shutil.which("espeak-ng") or shutil.which("espeak")
            if not espeak:
                raise RuntimeError(
                    "INTERNAL voice requires espeak-ng (Linux) or Windows SAPI"
                )
            wpm = max(80, min(400, round(170 * speed)))
            subprocess.run(
                [espeak, "-s", str(wpm), "-w", str(wav), "--stdin"],
                input=text,
                text=True,
                check=True,
                capture_output=True,
            )
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3)],
            check=True,
            capture_output=True,
        )
        return mp3.read_bytes()
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


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
