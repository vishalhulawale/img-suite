"""Passport photo creation endpoint."""

import io
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

router = APIRouter()

# Preset sizes: (width_inches, height_inches, label)
PRESETS = {
    "2x2": (2, 2, "US Passport (2×2 in)"),
    "35x45": (35, 45, "EU/UK Passport (35×45 mm)"),
    "33x48": (33, 48, "India Passport (33×48 mm)"),
    "51x51": (51, 51, "Canada Passport (51×51 mm)"),
}

# DPI for output
OUTPUT_DPI = 300


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return (255, 255, 255)
    try:
        return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore
    except ValueError:
        return (255, 255, 255)


def mm_to_pixels(mm: float, dpi: int = OUTPUT_DPI) -> int:
    """Convert millimeters to pixels."""
    return int(mm / 25.4 * dpi)


def inches_to_pixels(inches: float, dpi: int = OUTPUT_DPI) -> int:
    """Convert inches to pixels."""
    return int(inches * dpi)


@router.get("/passport/presets")
async def get_presets():
    """Return available passport photo presets."""
    return {
        key: {
            "width": v[0],
            "height": v[1],
            "label": v[2],
        }
        for key, v in PRESETS.items()
    }


@router.post("/passport")
async def create_passport_photo(
    file: UploadFile = File(..., description="Photo to convert to passport format"),
    preset: str = Form("2x2", description="Preset size key"),
    bg_color: str = Form("#FFFFFF", description="Background color in hex"),
    offset_x: int = Form(0, description="Horizontal face offset in pixels"),
    offset_y: int = Form(0, description="Vertical face offset in pixels"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Create a passport-style photo with the given preset and background color."""
    if preset not in PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown preset: {preset}. Available: {list(PRESETS.keys())}")

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open image file.")

    preset_data = PRESETS[preset]
    w_val, h_val = preset_data[0], preset_data[1]

    # Determine if preset is in mm or inches
    if preset == "2x2" or preset == "51x51":
        # Inches-based presets
        target_w = inches_to_pixels(w_val)
        target_h = inches_to_pixels(h_val)
    else:
        # mm-based presets
        target_w = mm_to_pixels(w_val)
        target_h = mm_to_pixels(h_val)

    bg_rgb = hex_to_rgb(bg_color)

    # Convert to RGBA if needed
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Resize to fit the target while keeping aspect ratio — center crop
    img_w, img_h = img.size
    target_ratio = target_w / target_h
    img_ratio = img_w / img_h

    if img_ratio > target_ratio:
        # Image is wider — fit height, crop width
        new_h = target_h
        new_w = int(target_h * img_ratio)
    else:
        # Image is taller — fit width, crop height
        new_w = target_w
        new_h = int(target_w / img_ratio)

    img = img.resize((new_w, new_h), Image.LANCZOS)

    # Center crop with offset
    left = (new_w - target_w) // 2 + offset_x
    top = (new_h - target_h) // 2 + offset_y

    # Clamp to valid bounds
    left = max(0, min(left, new_w - target_w))
    top = max(0, min(top, new_h - target_h))

    img = img.crop((left, top, left + target_w, top + target_h))

    # Create background and compose
    background = Image.new("RGBA", (target_w, target_h), (*bg_rgb, 255))
    background.paste(img, (0, 0), img)

    # Convert to RGB for JPEG output
    output = background.convert("RGB")

    buf = io.BytesIO()
    output.save(buf, format="JPEG", quality=95, dpi=(OUTPUT_DPI, OUTPUT_DPI))
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f'attachment; filename="passport_{preset}.jpg"',
        },
    )
