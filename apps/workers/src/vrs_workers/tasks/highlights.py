"""Highlight detection. Combines audio-energy peaks with scene-change detection
to produce ranked candidate clips."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import numpy as np

from ..celery_app import celery_app
from ..storage import download_tempfile
from ._base import job_lifecycle, succeed


@celery_app.task(name="vrs.highlights.detect", bind=True, max_retries=2, default_retry_delay=30)
def detect_highlights(
    self,  # noqa: ANN001
    *,
    job_id: str,
    asset_bucket: str,
    asset_key: str,
    target_duration_ms: int = 60_000,
    max_clips: int = 8,
) -> dict[str, Any]:
    with job_lifecycle(job_id, "highlights") as report:
        with download_tempfile(asset_bucket, asset_key, suffix=".mp4") as local:  # type: ignore[arg-type]
            report(0.15, "extracting audio waveform")
            energy = _extract_audio_energy(local)
            report(0.4, "detecting scene cuts")
            scenes = _detect_scene_cuts(local)
            report(0.7, "scoring candidates")
            candidates = _rank_candidates(energy, scenes, target_duration_ms, max_clips)

        out = {"clips": candidates, "sourceAssetKey": asset_key}
        succeed(job_id, out)
        return out


def _extract_audio_energy(file: Path) -> np.ndarray:
    """Compute per-100ms RMS energy via ffmpeg → numpy."""
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", str(file),
        "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-",
    ]
    proc = subprocess.run(cmd, check=True, capture_output=True)
    samples = np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32)
    # 100ms windows at 16kHz == 1600 samples
    win = 1600
    n = len(samples) // win
    if n == 0:
        return np.zeros(1, dtype=np.float32)
    trimmed = samples[: n * win].reshape(n, win)
    return np.sqrt(np.mean(trimmed.astype(np.float64) ** 2, axis=1))


def _detect_scene_cuts(file: Path, threshold: float = 0.4) -> list[float]:
    """Use ffmpeg's scene-detect filter to return scene-cut timestamps (seconds)."""
    cmd = [
        "ffmpeg", "-hide_banner", "-i", str(file),
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    cuts: list[float] = []
    for line in proc.stderr.splitlines():
        if "pts_time:" in line:
            try:
                t = float(line.split("pts_time:")[1].split()[0])
                cuts.append(t)
            except (IndexError, ValueError):
                continue
    return cuts


def _rank_candidates(
    energy: np.ndarray,
    scenes: list[float],
    target_duration_ms: int,
    max_clips: int,
) -> list[dict[str, Any]]:
    """Slide windows of `target_duration_ms` over the energy envelope, score by
    mean energy + scene-cut density, and return the top non-overlapping windows."""
    if energy.size == 0:
        return []

    window_steps = max(1, target_duration_ms // 100)
    step = max(1, window_steps // 4)
    # Vectorized rolling mean
    cumsum = np.cumsum(np.insert(energy, 0, 0))
    means = (cumsum[window_steps:] - cumsum[:-window_steps]) / window_steps
    if means.size == 0:
        return []

    scene_set = {int(s * 10) for s in scenes}  # bucket scenes into 100ms slots

    scores = []
    for i in range(0, len(means), step):
        start_ds = i  # decisec offset
        end_ds = i + window_steps
        scene_density = sum(1 for s in scene_set if start_ds <= s < end_ds)
        scores.append((float(means[i]) + 0.05 * scene_density, start_ds, end_ds))

    scores.sort(reverse=True)
    chosen: list[tuple[int, int]] = []
    for _, s, e in scores:
        if len(chosen) >= max_clips:
            break
        if all(e <= cs or s >= ce for cs, ce in chosen):
            chosen.append((s, e))

    chosen.sort()
    return [
        {
            "startMs": s * 100,
            "endMs": e * 100,
            "durationMs": (e - s) * 100,
            "score": float(np.mean(energy[s:e])),
        }
        for s, e in chosen
    ]
