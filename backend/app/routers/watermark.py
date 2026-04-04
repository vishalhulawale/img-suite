"""Watermark studio endpoint — text or image watermarks."""

import io
import logging
import math
import os
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

logger = logging.getLogger(__name__)

router = APIRouter()

# Try common font paths
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in FONT_PATHS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def hex_to_rgba(hex_color: str, opacity: float) -> tuple:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    else:
        r, g, b = 255, 255, 255
    return (r, g, b, int(opacity * 255))


@router.post("/watermark")
async def apply_watermark(
    file: UploadFile = File(...),
    watermark_image: UploadFile | None = File(None),
    text: str = Form(""),
    position: str = Form("bottom-right"),
    opacity: float = Form(0.5),
    font_size: int = Form(32),
    color: str = Form("#FFFFFF"),
    rotation: int = Form(0),
    padding: int = Form(20),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    if not text and not watermark_image:
        raise HTTPException(status_code=400, detail="Provide either text or a watermark image.")

    opacity = max(0.05, min(1.0, opacity))
    font_size = max(8, min(200, font_size))
    padding = max(0, min(500, padding))
    rotation = rotation % 360

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        logger.exception("Failed to open image file")
        raise HTTPException(status_code=400, detail="Could not open image file.")

    if img.mode != "RGBA":
        img = img.convert("RGBA")

    img_w, img_h = img.size

    if watermark_image and watermark_image.filename:
        # Image watermark
        wm_path = await save_upload(watermark_image, ALLOWED_IMAGE_MIME)
        background_tasks.add_task(cleanup_files, wm_path)

        try:
            wm = Image.open(wm_path)
            wm.load()
        except Exception:
            logger.exception("Failed to open watermark image")
            raise HTTPException(status_code=400, detail="Could not open watermark image.")

        if wm.mode != "RGBA":
            wm = wm.convert("RGBA")

        # Scale watermark relative to main image (font_size parameter repurposed as percentage)
        wm_scale = max(5, min(100, font_size)) / 100.0
        wm_w = int(img_w * wm_scale)
        wm_h = int(wm.height * (wm_w / wm.width))
        wm = wm.resize((wm_w, wm_h), Image.LANCZOS)

        # Apply opacity
        if opacity < 1.0:
            alpha = wm.split()[3]
            alpha = ImageEnhance.Brightness(alpha).enhance(opacity)
            wm.putalpha(alpha)

        # Rotate if needed
        if rotation:
            wm = wm.rotate(rotation, expand=True, resample=Image.BICUBIC)

        if position == "repeated":
            _apply_repeated(img, wm, padding)
        else:
            x, y = _calc_position(position, img_w, img_h, wm.width, wm.height, padding)
            img.paste(wm, (x, y), wm)
    else:
        # Text watermark
        font = get_font(font_size)
        rgba_color = hex_to_rgba(color, opacity)

        if position == "repeated":
            _apply_repeated_text(img, text, font, rgba_color, rotation, padding)
        elif position == "strip":
            _apply_strip_text(img, text, font, rgba_color, padding)
        else:
            overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            bbox = draw.textbbox((0, 0), text, font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

            x, y = _calc_position(position, img_w, img_h, tw, th, padding)

            if rotation:
                txt_img = Image.new("RGBA", (tw + 20, th + 20), (0, 0, 0, 0))
                txt_draw = ImageDraw.Draw(txt_img)
                txt_draw.text((10, 10), text, fill=rgba_color, font=font)
                txt_img = txt_img.rotate(rotation, expand=True, resample=Image.BICUBIC)
                overlay.paste(txt_img, (x, y), txt_img)
            else:
                draw.text((x, y), text, fill=rgba_color, font=font)

            img = Image.alpha_composite(img, overlay)

    # Output
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
            "Content-Disposition": f'attachment; filename="watermarked{ext}"',
        },
    )


def _calc_position(position: str, img_w: int, img_h: int, wm_w: int, wm_h: int, padding: int):
    positions = {
        "top-left": (padding, padding),
        "top-right": (img_w - wm_w - padding, padding),
        "bottom-left": (padding, img_h - wm_h - padding),
        "bottom-right": (img_w - wm_w - padding, img_h - wm_h - padding),
        "center": ((img_w - wm_w) // 2, (img_h - wm_h) // 2),
    }
    return positions.get(position, positions["bottom-right"])


def _apply_repeated(img: Image.Image, wm: Image.Image, spacing: int):
    """Tile watermark image across the entire image."""
    for y in range(0, img.height, wm.height + spacing):
        for x in range(0, img.width, wm.width + spacing):
            img.paste(wm, (x, y), wm)


def _apply_repeated_text(img: Image.Image, text: str, font, color, rotation: int, spacing: int):
    """Tile text watermark across the entire image."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    step_x = tw + spacing + 40
    step_y = th + spacing + 40

    if rotation:
        for y in range(-img.height, img.height * 2, step_y):
            for x in range(-img.width, img.width * 2, step_x):
                txt_img = Image.new("RGBA", (tw + 20, th + 20), (0, 0, 0, 0))
                txt_draw = ImageDraw.Draw(txt_img)
                txt_draw.text((10, 10), text, fill=color, font=font)
                txt_img = txt_img.rotate(rotation, expand=True, resample=Image.BICUBIC)
                if 0 <= x < img.width and 0 <= y < img.height:
                    overlay.paste(txt_img, (x, y), txt_img)
    else:
        for y in range(0, img.height, step_y):
            for x in range(0, img.width, step_x):
                draw.text((x, y), text, fill=color, font=font)

    combined = Image.alpha_composite(img, overlay)
    img.paste(combined)


def _apply_strip_text(img: Image.Image, text: str, font, color, padding: int):
    """Full-width text strip near the bottom."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    strip_h = th + padding * 2
    strip_y = img.height - strip_h

    # Semi-transparent black strip background
    strip_color = (0, 0, 0, int(0.4 * 255))
    draw.rectangle([0, strip_y, img.width, img.height], fill=strip_color)

    text_x = (img.width - tw) // 2
    text_y = strip_y + padding
    draw.text((text_x, text_y), text, fill=color, font=font)

    combined = Image.alpha_composite(img, overlay)
    img.paste(combined)
