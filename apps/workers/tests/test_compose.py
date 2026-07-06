"""Compose graph unit tests. Verifies filter-graph shape without invoking ffmpeg."""

from __future__ import annotations

from pathlib import Path

import pytest

from vrs_workers.compose import ComposeSpec, build_command


@pytest.fixture
def spec(tmp_path: Path) -> ComposeSpec:
    return ComposeSpec(
        output=tmp_path / "out.mp4",
        width=1080,
        height=1920,
        fps=30,
        bitrate_kbps=None,
        burn_captions=False,
        normalize_loudness=True,
        watermark=False,
    )


def test_single_video_clip_graph(spec: ComposeSpec, tmp_path: Path):
    asset_path = tmp_path / "asset-1.mp4"
    asset_path.touch()
    timeline = {
        "durationMs": 8000,
        "tracks": [
            {
                "id": "t1",
                "kind": "VIDEO",
                "index": 0,
                "muted": False,
                "locked": False,
                "clips": [
                    {
                        "id": "clip1234",
                        "startMs": 0,
                        "durationMs": 8000,
                        "inMs": 0,
                        "outMs": 8000,
                        "speed": 1.0,
                        "volume": 1.0,
                        "opacity": 1.0,
                        "asset": {"id": "asset-1", "s3Bucket": "uploads", "s3Key": "asset-1.mp4"},
                    }
                ],
            }
        ],
    }
    built = build_command(
        timeline=timeline,
        asset_paths={"asset-1": asset_path},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
    )
    assert built.argv[0] == "ffmpeg"
    assert "-filter_complex" in built.argv
    graph_index = built.argv.index("-filter_complex") + 1
    graph = built.argv[graph_index]
    assert "canvas" in graph
    assert "loudnorm" in graph
    assert "libx264" in built.argv


def test_missing_video_raises(spec: ComposeSpec):
    timeline = {"durationMs": 0, "tracks": []}
    built = build_command(
        timeline=timeline,
        asset_paths={},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
    )
    # No video sources → the argv should still include the canvas but no
    # scale filters; audio silence keeps the container valid.
    assert "-filter_complex" in built.argv


def test_atempo_chain_for_extreme_speed(spec: ComposeSpec, tmp_path: Path):
    from vrs_workers.compose import _atempo_chain

    fast = _atempo_chain(4.0)
    slow = _atempo_chain(0.25)
    assert "atempo=2.0,atempo=2.0" in fast
    assert "atempo=0.5,atempo=0.5" in slow


def _text_timeline() -> dict:
    return {
        "durationMs": 5000,
        "tracks": [
            {
                "id": "t1",
                "kind": "OVERLAY",
                "index": 0,
                "muted": False,
                "locked": False,
                "clips": [
                    {
                        "id": "textclip1",
                        "startMs": 1000,
                        "durationMs": 3000,
                        "inMs": 0,
                        "outMs": 3000,
                        "speed": 1.0,
                        "volume": 1.0,
                        "opacity": 1.0,
                        "textJson": {"text": "#1 Winner", "fontSize": 72},
                    }
                ],
            }
        ],
    }


def test_text_clip_becomes_looped_png_overlay(spec: ComposeSpec, tmp_path: Path):
    png = tmp_path / "text_textclip1.png"
    png.touch()
    built = build_command(
        timeline=_text_timeline(),
        asset_paths={},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
        text_paths={"textclip1": png},
    )
    # The PNG is a looped input bounded to the clip duration.
    loop_at = built.argv.index("-loop")
    assert built.argv[loop_at + 1] == "1"
    assert "-t" in built.argv[: built.argv.index("-filter_complex")]
    graph = built.argv[built.argv.index("-filter_complex") + 1]
    assert "format=rgba" in graph
    assert "enable='between(t,1.0,4.0)'" in graph
    # Text clips must not join the audio mix.
    assert "aclip" not in graph


def test_text_clip_without_rendered_png_is_skipped(spec: ComposeSpec):
    built = build_command(
        timeline=_text_timeline(),
        asset_paths={},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
        text_paths={},
    )
    graph = built.argv[built.argv.index("-filter_complex") + 1]
    assert "textclip1" not in graph


def test_canvas_background_color(spec: ComposeSpec):
    spec.background_color = "#2B2A2A"
    built = build_command(
        timeline={"durationMs": 1000, "tracks": []},
        asset_paths={},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
    )
    graph = built.argv[built.argv.index("-filter_complex") + 1]
    assert "color=c=0x2B2A2A" in graph


def test_transform_scale_letterboxes_and_centers(spec: ComposeSpec, tmp_path: Path):
    asset_path = tmp_path / "asset-1.mp4"
    asset_path.touch()
    timeline = {
        "durationMs": 4000,
        "tracks": [
            {
                "id": "t1",
                "kind": "VIDEO",
                "index": 0,
                "muted": False,
                "locked": False,
                "clips": [
                    {
                        "id": "clip1234",
                        "startMs": 0,
                        "durationMs": 4000,
                        "inMs": 0,
                        "outMs": 4000,
                        "speed": 1.0,
                        "volume": 1.0,
                        "opacity": 1.0,
                        "transformJson": {"scale": 0.8},
                        "asset": {"id": "asset-1", "s3Bucket": "uploads", "s3Key": "asset-1.mp4"},
                    }
                ],
            }
        ],
    }
    built = build_command(
        timeline=timeline,
        asset_paths={"asset-1": asset_path},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
    )
    graph = built.argv[built.argv.index("-filter_complex") + 1]
    # 80% of 1920 = 1536 box height, fit inside (not cover+crop).
    assert "scale=1080:1536:force_original_aspect_ratio=decrease" in graph
    assert "overlay=x=(W-w)/2+0.0:y=(H-h)/2+0.0" in graph


def test_fade_effect_renders_alpha_fades(spec: ComposeSpec, tmp_path: Path):
    asset_path = tmp_path / "asset-1.mp4"
    asset_path.touch()
    timeline = {
        "durationMs": 4000,
        "tracks": [
            {
                "id": "t1",
                "kind": "VIDEO",
                "index": 0,
                "muted": False,
                "locked": False,
                "clips": [
                    {
                        "id": "clipfade1",
                        "startMs": 0,
                        "durationMs": 4000,
                        "inMs": 0,
                        "outMs": 4000,
                        "speed": 1.0,
                        "volume": 1.0,
                        "opacity": 1.0,
                        "effectsJson": [{"type": "fade", "params": {"inMs": 300, "outMs": 300}}],
                        "asset": {"id": "asset-1", "s3Bucket": "uploads", "s3Key": "a.mp4"},
                    }
                ],
            }
        ],
    }
    built = build_command(
        timeline=timeline,
        asset_paths={"asset-1": asset_path},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
    )
    graph = built.argv[built.argv.index("-filter_complex") + 1]
    assert "fade=t=in:st=0:d=0.300:alpha=1" in graph
    assert "fade=t=out:st=3.700:d=0.300:alpha=1" in graph


def test_text_animation_and_exit_fade(spec: ComposeSpec, tmp_path: Path):
    png = tmp_path / "text.png"
    png.touch()
    timeline = {
        "durationMs": 4000,
        "tracks": [
            {
                "id": "t2",
                "kind": "OVERLAY",
                "index": 0,
                "muted": False,
                "locked": False,
                "clips": [
                    {
                        "id": "textclip1",
                        "startMs": 500,
                        "durationMs": 3000,
                        "inMs": 0,
                        "outMs": 3000,
                        "speed": 1.0,
                        "volume": 1.0,
                        "opacity": 1.0,
                        "textJson": {"text": "Hi", "animation": "pop"},
                        "effectsJson": [{"type": "fade", "params": {"inMs": 0, "outMs": 250}}],
                    }
                ],
            }
        ],
    }
    built = build_command(
        timeline=timeline,
        asset_paths={},
        voiceover_paths={},
        caption_srt_path=None,
        spec=spec,
        text_paths={"textclip1": png},
    )
    graph = built.argv[built.argv.index("-filter_complex") + 1]
    # 'pop' entrance approximated as a fast alpha fade; exit from effectsJson.
    assert "fade=t=in:st=0:d=0.180:alpha=1" in graph
    assert "fade=t=out:st=2.750:d=0.250:alpha=1" in graph
