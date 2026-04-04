"""Format conversion endpoint — convert between JPG, PNG, and WebP."""

import io
import os
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

logger = logging.getLogger(__name__)

router = APIRouter()

SUPPORTED_FORMATS = {
    "jpg": ("JPEG", "image/jpeg", ".jpg"),
    "jpeg": ("JPEG", "image/jpeg", ".jpg"),
    "png": ("PNG", "image/png", ".png"),
    "webp": ("WEBP", "image/webp", ".webp"),
    "avif": ("AVIF", "image/avif", ".avif"),
}


@router.post("/convert")
async def convert_image(
    file: UploadFile = File(...),
    format: str = Form("png"),
    quality: int = Form(90),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    fmt = format.lower().strip()
    if fmt not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}. Use jpg, png, webp, or avif.")

    quality = max(1, min(100, quality))

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        logger.exception("Failed to open image file")
        raise HTTPException(status_code=400, detail="Could not open image file.")

    original_ext = os.path.splitext(file.filename or "")[1].lower()
    pil_format, media_type, ext = SUPPORTED_FORMATS[fmt]

    # Handle transparency: if converting RGBA to JPEG, composite on white
    has_alpha = img.mode in ("RGBA", "LA", "PA")
    if pil_format == "JPEG" and has_alpha:
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "RGBA":
            background.paste(img, mask=img.split()[3])
        else:
            img = img.convert("RGBA")
            background.paste(img, mask=img.split()[3])
        img = background
    elif pil_format == "JPEG" and img.mode != "RGB":
        img = img.convert("RGB")
    elif pil_format == "AVIF" and has_alpha:
        img = img if img.mode == "RGBA" else img.convert("RGBA")

    buf = io.BytesIO()

    save_kwargs = {"format": pil_format, "optimize": True}
    if pil_format == "JPEG":
        save_kwargs["quality"] = 85
    elif pil_format == "WEBP":
        save_kwargs["quality"] = 80
        if has_alpha:
            img = img if img.mode == "RGBA" else img.convert("RGBA")
    elif pil_format == "AVIF":
        save_kwargs["quality"] = 65
        save_kwargs.pop("optimize", None)

    img.save(buf, **save_kwargs)
    buf.seek(0)

    original_size = os.path.getsize(path)
    output_size = buf.getbuffer().nbytes
    transparency_warning = ""
    if pil_format == "JPEG" and has_alpha:
        transparency_warning = "Transparency was replaced with a white background."

    filename = f"converted{ext}"

    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Original-Size": str(original_size),
            "X-Output-Size": str(output_size),
            "X-Original-Format": original_ext.lstrip(".") or "unknown",
            "X-Output-Format": fmt,
            "X-Transparency-Warning": transparency_warning,
        },
    )
