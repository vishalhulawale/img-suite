"""Image compression endpoint."""

import io
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

router = APIRouter()


def compress_image(
    img: Image.Image,
    level: str,
    target_size_kb: int | None,
    original_ext: str,
) -> tuple[io.BytesIO, str, str]:
    """Compress an image and return (buffer, media_type, extension)."""

    quality_map = {"low": 85, "medium": 60, "high": 30}
    quality = quality_map.get(level, 60)

    # Convert RGBA to RGB if saving as JPEG
    out_format = "JPEG"
    media_type = "image/jpeg"
    ext = ".jpg"

    if original_ext.lower() == ".png" and img.mode == "RGBA":
        # Keep PNG for transparency
        out_format = "PNG"
        media_type = "image/png"
        ext = ".png"
    elif img.mode == "RGBA":
        img = img.convert("RGB")

    if img.mode == "P":
        img = img.convert("RGB")

    buf = io.BytesIO()

    if out_format == "JPEG":
        img.save(buf, format="JPEG", quality=quality, optimize=True)
    else:
        # PNG compression: adjust compress_level based on quality level
        compress_level_map = {"low": 3, "medium": 6, "high": 9}
        compress_level = compress_level_map.get(level, 6)
        img.save(buf, format="PNG", optimize=True, compress_level=compress_level)

    # If target size is specified, iteratively adjust quality
    if target_size_kb and out_format == "JPEG":
        target_bytes = target_size_kb * 1024
        attempts = 0
        while buf.tell() > target_bytes and quality > 5 and attempts < 15:
            quality = max(5, quality - 5)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            attempts += 1

    buf.seek(0)
    return buf, media_type, ext


@router.post("/compress")
async def compress_endpoint(
    file: UploadFile = File(..., description="Image file to compress"),
    level: str = Form("medium", description="Compression level: low, medium, high"),
    target_size_kb: int | None = Form(None, description="Optional target size in KB"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Compress an image file."""
    if level not in ("low", "medium", "high"):
        raise HTTPException(status_code=400, detail="Level must be low, medium, or high.")

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    import os
    original_ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    original_size = os.path.getsize(path)

    try:
        img = Image.open(path)
        img.load()  # Force load into memory
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open image file.")

    buf, media_type, ext = compress_image(img, level, target_size_kb, original_ext)
    compressed_size = buf.getbuffer().nbytes

    if original_size > 0:
        ratio = round((1 - compressed_size / original_size) * 100, 1)
    else:
        ratio = 0

    filename = f"compressed{ext}"

    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Original-Size": str(original_size),
            "X-Compressed-Size": str(compressed_size),
            "X-Compression-Ratio": f"{ratio}%",
        },
    )
