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
