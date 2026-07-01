"""FFmpeg compose graph builder.

Turns a project timeline (as returned by /v1/internal/projects/:id/timeline)
into a single ffmpeg invocation that renders the composited output.

Design goals:
  * One FFmpeg process — no intermediate re-encodes.
  * Multi-track video with alpha (overlay tracks stacked in z-order).
  * Multi-track audio with per-clip volume envelopes and optional ducking
    against the loudest speech track.
  * Caption burn-in via WEBVTT + libass, or drawtext for word-by-word.
  * Configurable output aspect ratio, resolution, fps, and bitrate.
  * Loudness normalization on the final mix (EBU R128).

Input structure (subset):
  {
    "id": "...",
    "aspectRatio": "R9_16",
    "durationMs": 60000,
    "tracks": [
      {"id": "...", "kind": "VIDEO", "index": 0, "muted": false, "clips": [
        {"id": "...", "startMs": 0, "durationMs": 8000, "inMs": 0, "outMs": 8000,
         "speed": 1.0, "volume": 1.0, "opacity": 1.0,
         "asset": {"id": "...", "s3Bucket": "uploads", "s3Key": "..."}},
        ...
      ]},
      ...
    ],
    "captions": [{"id": "...", "enabled": true, "styleJson": {...}, "segmentsJson": [...]}]
  }
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Literal

from .logging import logger


ASPECT_TO_WH = {
    "R9_16": (1080, 1920),
    "R16_9": (1920, 1080),
    "R1_1": (1080, 1080),
    "R4_5": (1080, 1350),
}


@dataclass
class CompiledInput:
    """One `-i` argument for ffmpeg. `path` is the local file. `index` is the
    stream index assigned by argument order."""

    path: Path
    index: int


@dataclass
class ComposeSpec:
    output: Path
    width: int
    height: int
    fps: int
    bitrate_kbps: int | None
    burn_captions: bool
    normalize_loudness: bool
    watermark: bool
    watermark_path: Path | None = None
    background_music_path: Path | None = None
    background_music_volume: float = 0.15
    duck_music_against_voice: bool = True
    caption_style: dict[str, Any] = field(default_factory=dict)


@dataclass
class BuildResult:
    argv: list[str]
    inputs: list[CompiledInput]


def build_command(
    *,
    timeline: dict[str, Any],
    asset_paths: dict[str, Path],
    voiceover_paths: dict[str, Path],
    caption_srt_path: Path | None,
    spec: ComposeSpec,
) -> BuildResult:
    tracks = _sorted_tracks(timeline)
    inputs: list[CompiledInput] = []

    # Assign a stable input index to every asset/voiceover we reference.
    input_index: dict[str, int] = {}
    for track in tracks:
        for clip in track["clips"]:
            key = _clip_key(clip)
            if key is None:
                continue
            if key not in input_index:
                path = _resolve_clip_path(clip, asset_paths, voiceover_paths)
                if path is None:
                    continue
                input_index[key] = len(inputs)
                inputs.append(CompiledInput(path=path, index=len(inputs)))

    if spec.background_music_path is not None:
        bg_idx = len(inputs)
        inputs.append(CompiledInput(path=spec.background_music_path, index=bg_idx))
    else:
        bg_idx = None

    if spec.watermark and spec.watermark_path is not None:
        wm_idx = len(inputs)
        inputs.append(CompiledInput(path=spec.watermark_path, index=wm_idx))
    else:
        wm_idx = None

    video_labels: list[str] = []
    audio_labels: list[str] = []
    filter_parts: list[str] = []

    duration_s = timeline.get("durationMs", 0) / 1000.0 or 60.0
    canvas_label = "canvas"
    filter_parts.append(
        f"color=c=black:size={spec.width}x{spec.height}:r={spec.fps}:d={duration_s}[{canvas_label}]"
    )

    # ─── Video / overlay tracks (bottom-up compositing) ────────────────
    z_labels: list[str] = [canvas_label]
    for track in tracks:
        if track["kind"] not in ("VIDEO", "OVERLAY"):
            continue
        for clip in track["clips"]:
            key = _clip_key(clip)
            if key is None or key not in input_index:
                continue
            src = input_index[key]
            lbl = f"vclip{src}_{clip['id'][:8]}"
            filter_parts.append(
                _video_clip_filter(clip, src, spec, out_label=lbl)
            )
            merged = f"z{len(z_labels)}"
            filter_parts.append(_overlay_filter(z_labels[-1], lbl, clip, out_label=merged))
            z_labels.append(merged)
    video_labels.append(z_labels[-1])

    # ─── Caption burn-in ─────────────────────────────────────────────
    final_video = video_labels[-1]
    if spec.burn_captions and caption_srt_path is not None:
        subbed = "vsub"
        style = _ass_style_from(spec.caption_style)
        filter_parts.append(
            f"[{final_video}]subtitles={caption_srt_path.as_posix()}:force_style='{style}'[{subbed}]"
        )
        final_video = subbed

    # ─── Watermark overlay (top-right) ────────────────────────────────
    if wm_idx is not None:
        watermarked = "vwm"
        filter_parts.append(
            f"[{wm_idx}:v]scale=iw*0.18:-1[wmimg];[{final_video}][wmimg]"
            f"overlay=W-w-24:24[{watermarked}]"
        )
        final_video = watermarked

    # ─── Audio tracks ─────────────────────────────────────────────────
    for track in tracks:
        if track["kind"] not in ("VIDEO", "AUDIO"):
            continue
        for clip in track["clips"]:
            key = _clip_key(clip)
            if key is None or key not in input_index:
                continue
            src = input_index[key]
            volume = clip.get("volume", 1.0) * (0 if track.get("muted") else 1)
            lbl = f"aclip{src}_{clip['id'][:8]}"
            filter_parts.append(_audio_clip_filter(clip, src, volume, out_label=lbl))
            audio_labels.append(lbl)

    # Background music (looped, lowered, and ducked against voice if requested)
    if bg_idx is not None:
        bg_label = "bg"
        filter_parts.append(
            f"[{bg_idx}:a]aloop=loop=-1:size=2e9,atrim=0:{duration_s},"
            f"volume={spec.background_music_volume}[{bg_label}]"
        )
        if spec.duck_music_against_voice and audio_labels:
            # Sidechain the music against the sum of speech audio.
            mixed_voice = "voxmix"
            filter_parts.append(
                _mix(audio_labels, out_label=mixed_voice)
            )
            ducked = "bgducked"
            filter_parts.append(
                f"[{bg_label}][{mixed_voice}]sidechaincompress="
                f"threshold=0.05:ratio=8:attack=5:release=250[{ducked}]"
            )
            audio_labels = [ducked, mixed_voice]
        else:
            audio_labels.append(bg_label)

    if audio_labels:
        final_audio = "amix"
        filter_parts.append(_mix(audio_labels, out_label=final_audio))
        if spec.normalize_loudness:
            normalized = "aloud"
            filter_parts.append(
                f"[{final_audio}]loudnorm=I=-16:LRA=11:TP=-1.5[{normalized}]"
            )
            final_audio = normalized
    else:
        # Emit silence to keep containers happy.
        filter_parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{duration_s}[silence]")
        final_audio = "silence"

    filter_complex = ";".join(filter_parts)

    argv: list[str] = ["ffmpeg", "-hide_banner", "-loglevel", "warning", "-y"]
    for inp in inputs:
        argv += ["-i", str(inp.path)]
    argv += ["-filter_complex", filter_complex]
    argv += ["-map", f"[{final_video}]", "-map", f"[{final_audio}]"]
    argv += ["-r", str(spec.fps)]
    argv += ["-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-pix_fmt", "yuv420p"]
    argv += ["-movflags", "+faststart"]
    if spec.bitrate_kbps:
        argv += [
            "-b:v", f"{spec.bitrate_kbps}k",
            "-maxrate", f"{int(spec.bitrate_kbps * 1.5)}k",
            "-bufsize", f"{spec.bitrate_kbps * 2}k",
        ]
    else:
        argv += ["-crf", "20"]
    argv += ["-c:a", "aac", "-b:a", "192k"]
    argv += [str(spec.output)]

    logger.info("compose.built", inputs=len(inputs), filter_len=len(filter_complex))
    return BuildResult(argv=argv, inputs=inputs)


def run(argv: list[str]) -> None:
    logger.info("compose.run", head=" ".join(argv[:8]))
    subprocess.run(argv, check=True)


# ─── Helpers ──────────────────────────────────────────────────────────

def _sorted_tracks(timeline: dict[str, Any]) -> list[dict[str, Any]]:
    order = {"CAPTION": 0, "VIDEO": 1, "OVERLAY": 2, "AUDIO": 3}
    return sorted(
        timeline.get("tracks", []),
        key=lambda t: (order.get(t["kind"], 99), t.get("index", 0)),
    )


def _clip_key(clip: dict[str, Any]) -> str | None:
    if clip.get("asset"):
        return f"asset:{clip['asset']['id']}"
    if clip.get("voiceover"):
        return f"vo:{clip['voiceover']['id']}"
    return None


def _resolve_clip_path(
    clip: dict[str, Any],
    asset_paths: dict[str, Path],
    voiceover_paths: dict[str, Path],
) -> Path | None:
    if clip.get("asset"):
        return asset_paths.get(clip["asset"]["id"])
    if clip.get("voiceover"):
        return voiceover_paths.get(clip["voiceover"]["id"])
    return None


def _video_clip_filter(
    clip: dict[str, Any], src: int, spec: ComposeSpec, out_label: str
) -> str:
    """Trim, scale, and offset a single video clip to sit at its timeline slot."""
    start_s = clip["startMs"] / 1000.0
    in_s = clip.get("inMs", 0) / 1000.0
    duration_s = clip["durationMs"] / 1000.0
    speed = clip.get("speed", 1.0) or 1.0

    parts = [
        f"[{src}:v]trim=start={in_s}:duration={duration_s * speed}",
        f"setpts=(PTS-STARTPTS)/{speed}",
        f"scale={spec.width}:{spec.height}:force_original_aspect_ratio=increase",
        f"crop={spec.width}:{spec.height}",
        f"fps={spec.fps}",
        f"setpts=PTS+{start_s}/TB",
    ]
    if clip.get("opacity", 1.0) < 1.0:
        parts.append("format=yuva420p")
        parts.append(f"colorchannelmixer=aa={clip['opacity']:.3f}")
    return ",".join(parts) + f"[{out_label}]"


def _overlay_filter(
    base_label: str, top_label: str, clip: dict[str, Any], out_label: str
) -> str:
    start_s = clip["startMs"] / 1000.0
    end_s = start_s + clip["durationMs"] / 1000.0
    return (
        f"[{base_label}][{top_label}]overlay="
        f"enable='between(t,{start_s},{end_s})'[{out_label}]"
    )


def _audio_clip_filter(
    clip: dict[str, Any], src: int, volume: float, out_label: str
) -> str:
    start_s = clip["startMs"] / 1000.0
    in_s = clip.get("inMs", 0) / 1000.0
    duration_s = clip["durationMs"] / 1000.0
    speed = clip.get("speed", 1.0) or 1.0
    atempo = _atempo_chain(speed)
    delay_ms = int(start_s * 1000)
    parts = [
        f"[{src}:a]atrim=start={in_s}:duration={duration_s * speed}",
        f"asetpts=PTS-STARTPTS",
        atempo,
        f"volume={volume:.3f}",
        f"adelay={delay_ms}|{delay_ms}",
    ]
    return ",".join(p for p in parts if p) + f"[{out_label}]"


def _atempo_chain(speed: float) -> str:
    """`atempo` is bounded to [0.5, 2.0]; compose multiple stages for extremes."""
    if 0.5 <= speed <= 2.0:
        return f"atempo={speed}"
    stages: list[str] = []
    remaining = speed
    while remaining > 2.0:
        stages.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        stages.append("atempo=0.5")
        remaining *= 2.0
    stages.append(f"atempo={remaining:.4f}")
    return ",".join(stages)


def _mix(labels: Iterable[str], out_label: str) -> str:
    lbls = list(labels)
    if not lbls:
        return f"anullsrc[{out_label}]"
    if len(lbls) == 1:
        return f"[{lbls[0]}]acopy[{out_label}]"
    joined = "".join(f"[{l}]" for l in lbls)
    return f"{joined}amix=inputs={len(lbls)}:normalize=0:duration=longest[{out_label}]"


def _ass_style_from(style: dict[str, Any]) -> str:
    """Convert our JSON caption style into libass override syntax."""
    font = style.get("fontFamily", "Inter")
    size = int(style.get("fontSize", 48) * 0.6)  # libass sizes differ from px
    color = _ass_color(style.get("color", "#ffffff"))
    outline = _ass_color(style.get("outline", {}).get("color", "#000000"))
    return (
        f"FontName={font},FontSize={size},PrimaryColour={color},"
        f"OutlineColour={outline},BorderStyle=1,Outline=2,Shadow=0,Bold=-1,MarginV=80"
    )


def _ass_color(hex_str: str) -> str:
    hex_str = hex_str.lstrip("#")
    if len(hex_str) != 6:
        hex_str = "ffffff"
    r, g, b = hex_str[0:2], hex_str[2:4], hex_str[4:6]
    # ASS colours are AABBGGRR in hex.
    return f"&H00{b}{g}{r}"


class RenderPreset(str):
    """Named render targets. Consumed by the export task; frontends should
    surface them in a picker."""


PRESETS: dict[str, dict[str, int | Literal["MP4_H264", "MP4_H265"]]] = {
    "shorts_1080": {"width": 1080, "height": 1920, "fps": 30, "bitrate_kbps": 8000, "format": "MP4_H264"},
    "shorts_720": {"width": 720, "height": 1280, "fps": 30, "bitrate_kbps": 4000, "format": "MP4_H264"},
    "square_1080": {"width": 1080, "height": 1080, "fps": 30, "bitrate_kbps": 6000, "format": "MP4_H264"},
    "landscape_1080p": {"width": 1920, "height": 1080, "fps": 30, "bitrate_kbps": 10000, "format": "MP4_H264"},
    "landscape_4k": {"width": 3840, "height": 2160, "fps": 30, "bitrate_kbps": 25000, "format": "MP4_H265"},
}
