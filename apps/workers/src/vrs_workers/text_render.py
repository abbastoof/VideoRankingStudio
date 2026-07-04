"""Text-clip rasterizer.

Pre-renders every TEXT clip in a timeline to a canvas-sized transparent PNG
so the FFmpeg compose graph can overlay it like any other input. Doing this
with Pillow instead of drawtext gives us real font files, multi-line layout,
stroke outlines, and rounded background boxes — and later, fully stylized
rank numbers.

`textJson` fields honored (see packages/types/src/clips.ts clipTextSchema):
  text, fontFamily, fontSize, fontWeight, color, background, align,
  strokeColor, strokeWidth, xPct, yPct
Font sizes are design-space pixels: a 1080-wide portrait/square canvas or a
1920-wide landscape canvas. Rendering at other resolutions scales linearly.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from .logging import logger

_ASSETS_FONTS = Path(__file__).resolve().parent.parent.parent / "assets" / "fonts"


def fonts_dir() -> Path:
    override = os.environ.get("VRS_FONTS_DIR")
    return Path(override) if override else _ASSETS_FONTS


# family (lowercased) -> (regular file, bold file). Single-weight display
# fonts map both slots to the same file.
_FONT_FILES: dict[str, tuple[str, str]] = {
    "archivo black": ("ArchivoBlack-Regular.ttf", "ArchivoBlack-Regular.ttf"),
    "rubik": ("Rubik-Regular.ttf", "Rubik-Bold.ttf"),
    "inter": ("Inter-Regular.ttf", "Inter-Bold.ttf"),
}
_FALLBACK_FAMILY = "inter"


def _load_font(family: str, weight: int, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    key = family.strip().lower()
    files = _FONT_FILES.get(key) or _FONT_FILES[_FALLBACK_FAMILY]
    filename = files[1] if weight >= 600 else files[0]
    path = fonts_dir() / filename
    try:
        return ImageFont.truetype(str(path), size=size)
    except OSError:
        logger.warning("text_render.font_missing", family=family, path=str(path))
        return ImageFont.load_default(size=size)


def _parse_hex(v: str) -> tuple[int, int, int, int] | None:
    h = v[1:]
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) == 6:
        h += "ff"
    if len(h) != 8:
        return None
    try:
        return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4, 6))  # type: ignore[return-value]
    except ValueError:
        return None


def _parse_rgb_func(v: str) -> tuple[int, int, int, int] | None:
    try:
        inner = v[v.index("(") + 1 : v.rindex(")")]
        parts = [p.strip() for p in inner.split(",")]
        r, g, b = (int(float(p)) for p in parts[:3])
        a = int(float(parts[3]) * 255) if len(parts) > 3 else 255
        return (r, g, b, max(0, min(255, a)))
    except (ValueError, IndexError):
        return None


_NAMED_COLORS = {"black": (0, 0, 0, 255), "white": (255, 255, 255, 255)}


def _parse_color(value: Any, default: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Accepts #rgb, #rrggbb, #rrggbbaa, rgb(...), rgba(...); returns RGBA."""
    if not isinstance(value, str) or not value.strip():
        return default
    v = value.strip().lower()
    parsed: tuple[int, int, int, int] | None = None
    if v.startswith("#"):
        parsed = _parse_hex(v)
    elif v.startswith(("rgba(", "rgb(")):
        parsed = _parse_rgb_func(v)
    else:
        parsed = _NAMED_COLORS.get(v)
    return parsed if parsed is not None else default


def _design_width(width: int, height: int) -> int:
    return 1920 if width > height else 1080


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: Any, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw_line in text.split("\n"):
        words = raw_line.split(" ")
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and draw.textlength(candidate, font=font) > max_width:
                lines.append(current)
                current = word
            else:
                current = candidate
        lines.append(current)
    return lines or [""]


def render_text_png(
    text_json: dict[str, Any],
    *,
    width: int,
    height: int,
    out_path: Path,
) -> Path:
    """Render one text clip to a canvas-sized RGBA PNG at `out_path`."""
    scale = width / _design_width(width, height)
    text = str(text_json.get("text") or "")
    font_size = max(8, round(float(text_json.get("fontSize") or 48) * scale))
    weight = int(text_json.get("fontWeight") or 700)
    font = _load_font(str(text_json.get("fontFamily") or "Inter"), weight, font_size)
    fill = _parse_color(text_json.get("color"), (255, 255, 255, 255))
    background = (
        _parse_color(text_json.get("background"), (0, 0, 0, 0))
        if text_json.get("background")
        else None
    )
    stroke_width = round(float(text_json.get("strokeWidth") or 0) * scale)
    stroke_fill = _parse_color(text_json.get("strokeColor"), (0, 0, 0, 255))
    align = str(text_json.get("align") or "center")

    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = round(width * 0.05)
    max_text_width = width - 2 * margin
    lines = _wrap(draw, text, font, max_text_width)
    line_height = round(font_size * 1.25)
    block_height = line_height * len(lines)
    block_width = max(round(draw.textlength(line, font=font)) for line in lines) if lines else 0

    # Block center defaults: horizontal per alignment, vertical centered.
    x_pct = text_json.get("xPct")
    y_pct = text_json.get("yPct")
    if x_pct is not None:
        center_x = width * float(x_pct) / 100.0
    elif align == "left":
        center_x = margin + block_width / 2
    elif align == "right":
        center_x = width - margin - block_width / 2
    else:
        center_x = width / 2
    center_y = height * float(y_pct) / 100.0 if y_pct is not None else height / 2

    top = center_y - block_height / 2

    if background is not None and background[3] > 0:
        pad = round(font_size * 0.35)
        box = (
            center_x - block_width / 2 - pad,
            top - pad,
            center_x + block_width / 2 + pad,
            top + block_height + pad,
        )
        draw.rounded_rectangle(box, radius=round(font_size * 0.25), fill=background)

    for i, line in enumerate(lines):
        line_width = draw.textlength(line, font=font)
        if align == "left" and x_pct is None:
            x = margin
        elif align == "right" and x_pct is None:
            x = width - margin - line_width
        elif align == "left":
            x = center_x - block_width / 2
        elif align == "right":
            x = center_x + block_width / 2 - line_width
        else:
            x = center_x - line_width / 2
        y = top + i * line_height
        draw.text(
            (x, y),
            line,
            font=font,
            fill=fill,
            stroke_width=stroke_width,
            stroke_fill=stroke_fill if stroke_width > 0 else None,
        )

    img.save(out_path, "PNG")
    return out_path


def render_text_clips(
    timeline: dict[str, Any],
    work_dir: Path,
    *,
    width: int,
    height: int,
) -> dict[str, Path]:
    """Rasterize every text clip on VIDEO/OVERLAY tracks. Returns clip id -> PNG."""
    out: dict[str, Path] = {}
    for track in timeline.get("tracks", []):
        if track.get("kind") not in ("VIDEO", "OVERLAY"):
            continue
        for clip in track.get("clips", []):
            text_json = clip.get("textJson")
            if not text_json or not text_json.get("text"):
                continue
            dest = work_dir / f"text_{clip['id']}.png"
            try:
                render_text_png(text_json, width=width, height=height, out_path=dest)
                out[clip["id"]] = dest
            except Exception as exc:
                logger.warning("text_render.failed", clip_id=clip.get("id"), error=str(exc))
    return out
