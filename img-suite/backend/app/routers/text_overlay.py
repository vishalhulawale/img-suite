"""Text on image endpoint — add styled text layers to images."""

import io
import os
import json
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

router = APIRouter()

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

BOLD_FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
]


def _get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    paths = BOLD_FONT_PATHS if bold else FONT_PATHS
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    # Fallback: try regular paths if bold not found
    for p in FONT_PATHS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _hex_to_rgba(hex_color: str, opacity: float = 1.0) -> tuple:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    else:
        r, g, b = 255, 255, 255
    return (r, g, b, int(min(1.0, max(0.0, opacity)) * 255))


@router.post("/text-overlay")
async def text_overlay(
    file: UploadFile = File(...),
    layers: str = Form("[]"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Apply text layers to an image.

    layers is a JSON array of objects, each with:
      - text: str
      - x: int (pixels from left, as percentage 0-100 of image width)
      - y: int (pixels from top, as percentage 0-100 of image height)
      - font_size: int (default 32)
      - bold: bool (default false)
      - color: str hex (default #FFFFFF)
      - opacity: float 0-1 (default 1)
      - align: str (left, center, right — default center)
      - shadow: bool (default false)
      - outline: bool (default false)
      - bg_box: bool (default false) — adds a semi-transparent background behind text
      - bg_box_color: str hex (default #000000)
      - bg_box_opacity: float 0-1 (default 0.5)
    """
    try:
        layer_list = json.loads(layers)
        if not isinstance(layer_list, list):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="layers must be a valid JSON array.")

    if len(layer_list) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 text layers allowed.")

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open image file.")

    if img.mode != "RGBA":
        img = img.convert("RGBA")

    img_w, img_h = img.size

    for layer in layer_list:
        text = str(layer.get("text", ""))
        if not text:
            continue

        x_pct = float(layer.get("x", 50))
        y_pct = float(layer.get("y", 50))
        font_size = max(8, min(300, int(layer.get("font_size", 32))))
        bold = bool(layer.get("bold", False))
        color = str(layer.get("color", "#FFFFFF"))
        opacity = float(layer.get("opacity", 1.0))
        align = str(layer.get("align", "center"))
        shadow = bool(layer.get("shadow", False))
        outline = bool(layer.get("outline", False))
        bg_box = bool(layer.get("bg_box", False))
        bg_box_color = str(layer.get("bg_box_color", "#000000"))
        bg_box_opacity = float(layer.get("bg_box_opacity", 0.5))

        font = _get_font(font_size, bold)
        fill = _hex_to_rgba(color, opacity)

        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Calculate text size
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

        # Convert percentage position to pixels
        px = int((x_pct / 100) * img_w)
        py = int((y_pct / 100) * img_h)

        # Adjust for alignment
        if align == "center":
            px -= tw // 2
        elif align == "right":
            px -= tw

        # Background box
        if bg_box:
            box_pad = max(6, font_size // 4)
            box_fill = _hex_to_rgba(bg_box_color, bg_box_opacity)
            draw.rounded_rectangle(
                [px - box_pad, py - box_pad, px + tw + box_pad, py + th + box_pad],
                radius=box_pad,
                fill=box_fill,
            )

        # Shadow
        if shadow:
            shadow_offset = max(2, font_size // 16)
            shadow_color = (0, 0, 0, int(opacity * 180))
            draw.text((px + shadow_offset, py + shadow_offset), text, fill=shadow_color, font=font)

        # Outline
        if outline:
            outline_w = max(1, font_size // 20)
            outline_color = (0, 0, 0, int(opacity * 255))
            for dx in range(-outline_w, outline_w + 1):
                for dy in range(-outline_w, outline_w + 1):
                    if dx == 0 and dy == 0:
                        continue
                    draw.text((px + dx, py + dy), text, fill=outline_color, font=font)

        # Main text
        draw.text((px, py), text, fill=fill, font=font)

        img = Image.alpha_composite(img, overlay)

    # Output format
    original_ext = os.path.splitext(file.filename or "")[1].lower()
    if original_ext == ".png":
        out_format, media_type, ext = "PNG", "image/png", ".png"
    elif original_ext == ".webp":
        out_format, media_type, ext = "WEBP", "image/webp", ".webp"
    elif original_ext == ".avif":
        out_format, media_type, ext = "AVIF", "image/avif", ".avif"
    else:
        out_format, media_type, ext = "JPEG", "image/jpeg", ".jpg"
        img = img.convert("RGB")

    buf = io.BytesIO()
    save_kwargs = {"format": out_format, "optimize": True}
    if out_format in ("JPEG", "WEBP"):
        save_kwargs["quality"] = 95
    elif out_format == "AVIF":
        save_kwargs = {"format": "AVIF", "quality": 80}
    img.save(buf, **save_kwargs)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="text-image{ext}"',
        },
    )
