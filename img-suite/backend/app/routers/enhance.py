"""Auto-enhance endpoint — brightness, contrast, saturation, sharpness."""

import io
import os
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image, ImageEnhance, ImageFilter

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

logger = logging.getLogger(__name__)

router = APIRouter()

# Enhancement factors per intensity level
# Each tuple: (brightness, contrast, saturation, sharpness)
INTENSITY_MAP = {
    "low": (1.03, 1.08, 1.06, 1.1),
    "medium": (1.06, 1.15, 1.12, 1.25),
    "high": (1.10, 1.25, 1.20, 1.45),
}


@router.post("/enhance")
async def enhance_image(
    file: UploadFile = File(...),
    intensity: str = Form("medium"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    if intensity not in INTENSITY_MAP:
        raise HTTPException(status_code=400, detail="Intensity must be low, medium, or high.")

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        logger.exception("Failed to open image file")
        raise HTTPException(status_code=400, detail="Could not open image file.")

    brightness_f, contrast_f, saturation_f, sharpness_f = INTENSITY_MAP[intensity]

    # Convert to RGB for enhancement if needed (keep alpha separate)
    alpha = None
    if img.mode == "RGBA":
        alpha = img.split()[3]
        img = img.convert("RGB")
    elif img.mode not in ("RGB",):
        img = img.convert("RGB")

    # Apply enhancements in a natural order
    img = ImageEnhance.Brightness(img).enhance(brightness_f)
    img = ImageEnhance.Contrast(img).enhance(contrast_f)
    img = ImageEnhance.Color(img).enhance(saturation_f)
    img = ImageEnhance.Sharpness(img).enhance(sharpness_f)

    # Gentle unsharp mask for extra clarity at medium/high
    if intensity in ("medium", "high"):
        radius = 1.5 if intensity == "medium" else 2.0
        img = img.filter(ImageFilter.UnsharpMask(radius=radius, percent=80, threshold=2))

    # Restore alpha if present
    if alpha:
        img = img.convert("RGBA")
        img.putalpha(alpha)

    # Output format based on original
    original_ext = os.path.splitext(file.filename or "")[1].lower()
    if original_ext == ".png" or alpha:
        out_format = "PNG"
        media_type = "image/png"
        ext = ".png"
    elif original_ext == ".webp":
        out_format = "WEBP"
        media_type = "image/webp"
        ext = ".webp"
    elif original_ext == ".avif":
        out_format = "AVIF"
        media_type = "image/avif"
        ext = ".avif"
    else:
        out_format = "JPEG"
        media_type = "image/jpeg"
        ext = ".jpg"

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
            "Content-Disposition": f'attachment; filename="enhanced{ext}"',
            "X-Enhancement-Intensity": intensity,
        },
    )
