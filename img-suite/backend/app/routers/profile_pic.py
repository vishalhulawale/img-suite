"""Profile picture maker endpoint — platform-specific avatar crops."""

import io
import os
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image, ImageFilter

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

logger = logging.getLogger(__name__)

router = APIRouter()

PLATFORM_PRESETS = {
    "whatsapp": {"size": 640, "label": "WhatsApp (640×640)"},
    "instagram": {"size": 1080, "label": "Instagram (1080×1080)"},
    "linkedin": {"size": 400, "label": "LinkedIn (400×400)"},
    "facebook": {"size": 320, "label": "Facebook (320×320)"},
    "x": {"size": 400, "label": "X / Twitter (400×400)"},
    "youtube": {"size": 800, "label": "YouTube (800×800)"},
    "discord": {"size": 512, "label": "Discord (512×512)"},
    "custom": {"size": 500, "label": "Custom (500×500)"},
}


@router.get("/profile-picture/presets")
async def get_profile_presets():
    return {
        key: {"size": v["size"], "label": v["label"]}
        for key, v in PLATFORM_PRESETS.items()
    }


@router.post("/profile-picture")
async def create_profile_picture(
    file: UploadFile = File(...),
    platform: str = Form("instagram"),
    custom_size: int = Form(500),
    offset_x: float = Form(0),
    offset_y: float = Form(0),
    zoom: float = Form(1.0),
    bg_mode: str = Form("color"),
    bg_color: str = Form("#FFFFFF"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Create a square profile picture for a given platform.

    offset_x, offset_y: -1.0 to 1.0 (fraction of available movement range)
    zoom: 1.0 to 3.0 (additional zoom factor)
    bg_mode: 'color' | 'blur' — how to fill background if needed
    """
    if platform not in PLATFORM_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {platform}")

    if platform == "custom":
        target_size = max(64, min(2048, custom_size))
    else:
        target_size = PLATFORM_PRESETS[platform]["size"]

    zoom = max(1.0, min(3.0, zoom))
    offset_x = max(-1.0, min(1.0, offset_x))
    offset_y = max(-1.0, min(1.0, offset_y))

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        logger.exception("Failed to open image file")
        raise HTTPException(status_code=400, detail="Could not open image file.")

    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    img_w, img_h = img.size

    # Calculate crop region for square output
    base_crop = min(img_w, img_h)
    crop_size = int(base_crop / zoom)
    crop_size = max(1, min(crop_size, min(img_w, img_h)))

    # Center position
    cx = (img_w - crop_size) / 2
    cy = (img_h - crop_size) / 2

    # Apply offsets (fraction of available movement)
    max_dx = (img_w - crop_size) / 2
    max_dy = (img_h - crop_size) / 2
    cx += offset_x * max_dx
    cy += offset_y * max_dy

    # Clamp
    cx = max(0, min(cx, img_w - crop_size))
    cy = max(0, min(cy, img_h - crop_size))

    crop_box = (int(cx), int(cy), int(cx + crop_size), int(cy + crop_size))
    cropped = img.crop(crop_box)

    # If the image is very non-square and zoom=1, we may want background fill
    aspect_ratio = img_w / img_h if img_h > 0 else 1
    needs_bg = (aspect_ratio > 1.4 or aspect_ratio < 0.7) and zoom <= 1.05

    if needs_bg and bg_mode == "blur":
        # Create blurred background
        bg = img.copy()
        bg = bg.resize((target_size, target_size), Image.LANCZOS)
        bg = bg.filter(ImageFilter.GaussianBlur(radius=20))

        # Resize the original to fit within the square
        if img_w > img_h:
            new_h = target_size
            new_w = int(img_w * (target_size / img_h))
        else:
            new_w = target_size
            new_h = int(img_h * (target_size / img_w))
        fitted = img.resize((new_w, new_h), Image.LANCZOS)

        # Center the fitted image
        px = (target_size - new_w) // 2
        py = (target_size - new_h) // 2

        # Crop the fitted to square
        if new_w > target_size:
            left = (new_w - target_size) // 2
            fitted = fitted.crop((left, 0, left + target_size, target_size))
            px = 0
        if new_h > target_size:
            top = (new_h - target_size) // 2
            fitted = fitted.crop((0, top, target_size, top + target_size))
            py = 0

        if fitted.mode == "RGBA":
            bg = bg.convert("RGBA")
            bg.paste(fitted, (px, py), fitted)
        else:
            bg.paste(fitted, (px, py))

        output = bg
    else:
        output = cropped.resize((target_size, target_size), Image.LANCZOS)

    if output.mode == "RGBA":
        hex_color = bg_color.lstrip("#")
        if len(hex_color) == 6:
            r, g, b = (int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        else:
            r, g, b = 255, 255, 255
        bg_img = Image.new("RGB", output.size, (r, g, b))
        bg_img.paste(output, mask=output.split()[3])
        output = bg_img
    elif output.mode != "RGB":
        output = output.convert("RGB")

    buf = io.BytesIO()
    output.save(buf, format="JPEG", quality=95)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f'attachment; filename="profile_{platform}.jpg"',
            "X-Output-Size": f"{target_size}x{target_size}",
            "X-Platform": platform,
        },
    )
