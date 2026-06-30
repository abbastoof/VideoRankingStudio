"""Transcription task. Routes between OpenAI Whisper API, local faster-whisper,
or Deepgram based on STT_PROVIDER. All return the same shape so callers don't
care which engine ran."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..celery_app import celery_app
from ..config import settings
from ..logging import logger
from ..storage import download_tempfile, upload_bytes
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.transcribe", bind=True, max_retries=2, default_retry_delay=30)
def transcribe(
    self,  # noqa: ANN001 — celery binds self
    *,
    job_id: str,
    asset_bucket: str,
    asset_key: str,
    language: str = "auto",
    diarize: bool = False,
    output_key_prefix: str,
) -> dict[str, Any]:
    """Transcribe an audio/video asset.

    Returns a dict with: language, durationMs, segments, srtKey, vttKey, text.
    """
    with job_lifecycle(job_id, "transcription") as report:
        with download_tempfile(asset_bucket, asset_key, suffix=Path(asset_key).suffix) as local:  # type: ignore[arg-type]
            report(0.1, f"loaded asset ({local.stat().st_size} bytes)")

            if settings.stt_provider == "openai_whisper":
                result = _transcribe_openai(local, language, report)
            elif settings.stt_provider == "local_whisper":
                result = _transcribe_local(local, language, report)
            elif settings.stt_provider == "deepgram":
                result = _transcribe_deepgram(local, language, diarize, report)
            else:
                raise RuntimeError(f"Unsupported STT_PROVIDER: {settings.stt_provider}")

        report(0.85, "writing subtitle files")
        srt = _segments_to_srt(result["segments"])
        vtt = _segments_to_vtt(result["segments"])
        srt_key = f"{output_key_prefix}/transcript.srt"
        vtt_key = f"{output_key_prefix}/transcript.vtt"
        upload_bytes("generated", srt_key, srt.encode("utf-8"), content_type="application/x-subrip")
        upload_bytes("generated", vtt_key, vtt.encode("utf-8"), content_type="text/vtt")
        upload_bytes(
            "generated",
            f"{output_key_prefix}/transcript.json",
            json.dumps(result, ensure_ascii=False).encode("utf-8"),
            content_type="application/json",
        )

        out = {
            "language": result["language"],
            "durationMs": result["durationMs"],
            "segments": result["segments"],
            "text": result["text"],
            "srtKey": srt_key,
            "vttKey": vtt_key,
        }
        succeed(job_id, out)
        return out


def _transcribe_openai(file: Path, language: str, report) -> dict[str, Any]:  # noqa: ANN001
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for openai_whisper")
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    report(0.3, "calling OpenAI Whisper")
    with file.open("rb") as fp:
        resp = client.audio.transcriptions.create(
            file=fp,
            model="whisper-1",
            response_format="verbose_json",
            timestamp_granularities=["segment", "word"],
            language=None if language in ("auto", "") else language,
        )
    report(0.7, "processing transcript")
    segments = [
        {
            "index": i,
            "startMs": int(s.start * 1000),
            "endMs": int(s.end * 1000),
            "text": s.text.strip(),
            "speakerLabel": None,
            "confidence": getattr(s, "avg_logprob", None),
            "words": _extract_words(s),
        }
        for i, s in enumerate(resp.segments or [])
    ]
    return {
        "language": resp.language or "en",
        "durationMs": int((resp.duration or 0) * 1000),
        "segments": segments,
        "text": resp.text or "",
    }


def _extract_words(seg: Any) -> list[dict[str, Any]]:
    words = getattr(seg, "words", None) or []
    return [
        {"word": w.word, "startMs": int(w.start * 1000), "endMs": int(w.end * 1000)}
        for w in words
    ]


def _transcribe_local(file: Path, language: str, report) -> dict[str, Any]:  # noqa: ANN001
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError("faster-whisper not installed; pip install '.[whisper]'") from exc

    logger.info("whisper.load", model=settings.local_whisper_model, device=settings.local_whisper_device)
    model = WhisperModel(
        settings.local_whisper_model,
        device=settings.local_whisper_device,
        compute_type="int8" if settings.local_whisper_device == "cpu" else "float16",
    )
    report(0.3, "running local whisper")
    segments_iter, info = model.transcribe(
        str(file),
        language=None if language in ("auto", "") else language,
        word_timestamps=True,
        vad_filter=True,
    )

    segments: list[dict[str, Any]] = []
    full_text: list[str] = []
    last_progress = 0.3
    for i, seg in enumerate(segments_iter):
        words = [
            {"word": w.word, "startMs": int(w.start * 1000), "endMs": int(w.end * 1000), "confidence": w.probability}
            for w in (seg.words or [])
        ]
        segments.append({
            "index": i,
            "startMs": int(seg.start * 1000),
            "endMs": int(seg.end * 1000),
            "text": seg.text.strip(),
            "speakerLabel": None,
            "confidence": seg.avg_logprob,
            "words": words,
        })
        full_text.append(seg.text)
        if info.duration:
            cur = 0.3 + (seg.end / info.duration) * 0.4
            if cur - last_progress >= 0.05:
                report(min(cur, 0.7))
                last_progress = cur

    return {
        "language": info.language or "en",
        "durationMs": int((info.duration or 0) * 1000),
        "segments": segments,
        "text": " ".join(t.strip() for t in full_text),
    }


def _transcribe_deepgram(file: Path, language: str, diarize: bool, report) -> dict[str, Any]:  # noqa: ANN001
    if not settings.deepgram_api_key:
        raise RuntimeError("DEEPGRAM_API_KEY is required for deepgram")
    import httpx

    params = {"smart_format": "true", "punctuate": "true", "utterances": "true"}
    if language and language != "auto":
        params["language"] = language
    else:
        params["detect_language"] = "true"
    if diarize:
        params["diarize"] = "true"

    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": "audio/*",
    }
    report(0.3, "uploading to Deepgram")
    with file.open("rb") as fp:
        res = httpx.post(
            "https://api.deepgram.com/v1/listen",
            params=params,
            headers=headers,
            content=fp.read(),
            timeout=300.0,
        )
    res.raise_for_status()
    data = res.json()
    channel = data["results"]["channels"][0]
    alt = channel["alternatives"][0]
    duration_ms = int((data.get("metadata", {}).get("duration", 0)) * 1000)
    language_code = channel.get("detected_language") or language or "en"

    segments = []
    for i, utt in enumerate(data["results"].get("utterances", [])):
        words = [
            {"word": w["word"], "startMs": int(w["start"] * 1000), "endMs": int(w["end"] * 1000), "confidence": w.get("confidence")}
            for w in utt.get("words", [])
        ]
        segments.append({
            "index": i,
            "startMs": int(utt["start"] * 1000),
            "endMs": int(utt["end"] * 1000),
            "text": utt["transcript"].strip(),
            "speakerLabel": str(utt.get("speaker")) if "speaker" in utt else None,
            "confidence": utt.get("confidence"),
            "words": words,
        })

    return {
        "language": language_code,
        "durationMs": duration_ms,
        "segments": segments,
        "text": alt.get("transcript", ""),
    }


def _segments_to_srt(segments: list[dict[str, Any]]) -> str:
    def fmt(ms: int) -> str:
        h, ms = divmod(ms, 3_600_000)
        m, ms = divmod(ms, 60_000)
        s, ms = divmod(ms, 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    out: list[str] = []
    for i, s in enumerate(segments, start=1):
        out.append(f"{i}\n{fmt(s['startMs'])} --> {fmt(s['endMs'])}\n{s['text']}\n")
    return "\n".join(out)


def _segments_to_vtt(segments: list[dict[str, Any]]) -> str:
    def fmt(ms: int) -> str:
        h, ms = divmod(ms, 3_600_000)
        m, ms = divmod(ms, 60_000)
        s, ms = divmod(ms, 1000)
        return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

    out = ["WEBVTT", ""]
    for s in segments:
        out.append(f"{fmt(s['startMs'])} --> {fmt(s['endMs'])}\n{s['text']}\n")
    return "\n".join(out)
