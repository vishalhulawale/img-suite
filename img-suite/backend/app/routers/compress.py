"""Image compression endpoint."""

import io
import os
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

router = APIRouter()


def _compress_to_target(img: Image.Image, target_bytes: int, out_format: str) -> io.BytesIO:
    """Binary-search for the quality that gets closest to target_bytes."""
    if out_format == "PNG":
        # PNG is lossless; try max compression then resize down if still too large
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True, compress_level=9)
        if buf.tell() <= target_bytes:
            buf.seek(0)
            return buf
        # Iteratively scale down to meet target
        scale = 0.95
        tmp = img.copy()
        for _ in range(20):
            new_w = max(1, int(tmp.width * scale))
            new_h = max(1, int(tmp.height * scale))
            tmp = img.resize((new_w, new_h), Image.LANCZOS)
            buf = io.BytesIO()
            tmp.save(buf, format="PNG", optimize=True, compress_level=9)
            if buf.tell() <= target_bytes:
                buf.seek(0)
                return buf
            scale *= 0.95
        buf.seek(0)
        return buf

    # JPEG / WEBP: binary search on quality
    lo, hi = 5, 95
    best_buf = io.BytesIO()
    img.save(best_buf, format=out_format, quality=lo, optimize=True)

    for _ in range(15):
        if hi - lo < 2:
            break
        mid = (lo + hi) // 2
        buf = io.BytesIO()
        img.save(buf, format=out_format, quality=mid, optimize=True)
        if buf.tell() <= target_bytes:
            best_buf = buf
            lo = mid + 1
        else:
            hi = mid - 1

    # Final attempt at hi
    buf = io.BytesIO()
    img.save(buf, format=out_format, quality=hi, optimize=True)
    if buf.tell() <= target_bytes:
        best_buf = buf

    best_buf.seek(0)
    return best_buf


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
        out_format = "PNG"
        media_type = "image/png"
        ext = ".png"
    elif original_ext.lower() == ".avif":
        out_format = "AVIF"
        media_type = "image/avif"
        ext = ".avif"
    elif img.mode == "RGBA":
        img = img.convert("RGB")

    if img.mode == "P":
        img = img.convert("RGB")

    # Custom level: use target-size binary search
    if level == "custom" and target_size_kb:
        target_bytes = target_size_kb * 1024
        buf = _compress_to_target(img, target_bytes, out_format)
        return buf, media_type, ext

    buf = io.BytesIO()

    if out_format == "JPEG":
        img.save(buf, format="JPEG", quality=quality, optimize=True)
    elif out_format == "AVIF":
        img.save(buf, format="AVIF", quality=quality)
    else:
        compress_level_map = {"low": 3, "medium": 6, "high": 9}
        compress_level = compress_level_map.get(level, 6)
        img.save(buf, format="PNG", optimize=True, compress_level=compress_level)

    buf.seek(0)
    return buf, media_type, ext


@router.post("/compress")
async def compress_endpoint(
    file: UploadFile = File(..., description="Image file to compress"),
    level: str = Form("medium", description="Compression level: low, medium, high, custom"),
    target_size_kb: int | None = Form(None, description="Target size in KB (for custom level)"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Compress an image file."""
    if level not in ("low", "medium", "high", "custom"):
        raise HTTPException(status_code=400, detail="Level must be low, medium, high, or custom.")

    if level == "custom" and not target_size_kb:
        raise HTTPException(status_code=400, detail="Target size in KB is required for custom level.")

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    original_ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    original_size = os.path.getsize(path)

    try:
        img = Image.open(path)
        img.load()
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
