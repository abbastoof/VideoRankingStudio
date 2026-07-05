"""Text rasterizer tests — verify PNG output without invoking ffmpeg."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from vrs_workers.text_render import _parse_color, render_text_clips, render_text_png


def test_renders_canvas_sized_rgba_png(tmp_path: Path):
    out = tmp_path / "t.png"
    render_text_png(
        {"text": "#1  •  Winner", "fontSize": 72, "color": "#ffffff"},
        width=540,
        height=960,
        out_path=out,
    )
    with Image.open(out) as img:
        assert img.size == (540, 960)
        assert img.mode == "RGBA"
        # Something must actually have been drawn.
        assert img.getbbox() is not None


def test_stroke_and_background_render(tmp_path: Path):
    out = tmp_path / "t.png"
    render_text_png(
        {
            "text": "Almost became a stat",
            "fontFamily": "Archivo Black",
            "fontSize": 48,
            "color": "#ff8800",
            "background": "rgba(0,0,0,0.65)",
            "strokeColor": "#000000",
            "strokeWidth": 4,
            "yPct": 20,
        },
        width=1080,
        height=1920,
        out_path=out,
    )
    with Image.open(out) as img:
        bbox = img.getbbox()
        assert bbox is not None
        # yPct=20 → drawn content sits in the upper half of the canvas.
        assert bbox[1] < 1920 * 0.5


def test_render_text_clips_walks_video_and_overlay_tracks(tmp_path: Path):
    timeline = {
        "tracks": [
            {
                "kind": "OVERLAY",
                "clips": [
                    {"id": "c1", "textJson": {"text": "hello"}},
                    {"id": "c2", "textJson": None},
                ],
            },
            {"kind": "AUDIO", "clips": [{"id": "c3", "textJson": {"text": "skip me"}}]},
        ]
    }
    out = render_text_clips(timeline, tmp_path, width=270, height=480)
    assert set(out) == {"c1"}
    assert out["c1"].exists()


def test_parse_color_variants():
    assert _parse_color("#fff", (0, 0, 0, 0)) == (255, 255, 255, 255)
    assert _parse_color("#2B2A2A", (0, 0, 0, 0)) == (43, 42, 42, 255)
    assert _parse_color("rgba(0,0,0,0.65)", (0, 0, 0, 0)) == (0, 0, 0, 165)
    assert _parse_color("rgb(10, 20, 30)", (0, 0, 0, 0)) == (10, 20, 30, 255)
    assert _parse_color("bogus", (1, 2, 3, 4)) == (1, 2, 3, 4)
    assert _parse_color(None, (1, 2, 3, 4)) == (1, 2, 3, 4)


def test_italic_shears_glyphs_but_not_background(tmp_path: Path):
    """Synthetic oblique: the sheared glyph layer must lean while the pill
    stays rectangular — compare against the upright render."""
    upright = tmp_path / "upright.png"
    italic = tmp_path / "italic.png"
    base = {
        "text": "LEAN",
        "fontFamily": "Archivo Black",
        "fontSize": 120,
        "color": "#ffffff",
        "yPct": 50,
    }
    render_text_png({**base, "italic": False}, width=1080, height=1080, out_path=upright)
    render_text_png({**base, "italic": True}, width=1080, height=1080, out_path=italic)
    with Image.open(upright) as u, Image.open(italic) as i:
        ub, ib = u.getbbox(), i.getbbox()
        assert ub is not None and ib is not None
        # The sheared block is wider than the upright one and shifted right
        # at the top (glyph pixels differ).
        assert (ib[2] - ib[0]) > (ub[2] - ub[0])
        assert list(u.getdata()) != list(i.getdata())
