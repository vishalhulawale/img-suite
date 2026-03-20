"""Image upscaler endpoint — CPU-friendly Lanczos + sharpening."""

import io
import os
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image, ImageFilter

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

router = APIRouter()

MAX_OUTPUT_PIXELS = 4096 * 4096  # ~16 MP safety limit


@router.post("/upscale")
async def upscale_image(
    file: UploadFile = File(...),
    scale: int = Form(2),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    if scale not in (2, 4):
        raise HTTPException(status_code=400, detail="Scale must be 2 or 4.")

    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open image file.")

    orig_w, orig_h = img.size
    new_w = orig_w * scale
    new_h = orig_h * scale

    if new_w * new_h > MAX_OUTPUT_PIXELS:
        raise HTTPException(
            status_code=400,
            detail=f"Output would be {new_w}×{new_h} ({new_w * new_h // 1_000_000}MP). "
                   f"Maximum output is ~16 MP. Try a smaller image or lower scale.",
        )

    # Upscale with LANCZOS (best quality resampling in Pillow)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    # Apply sharpening to recover detail
    # More aggressive for 4x since it gets blurrier
    if scale == 2:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=100, threshold=1))
    else:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=120, threshold=1))
        img = img.filter(ImageFilter.UnsharpMask(radius=0.5, percent=50, threshold=2))

    out_w, out_h = img.size

    # Output format based on original
    original_ext = os.path.splitext(file.filename or "")[1].lower()
    has_alpha = img.mode in ("RGBA", "LA", "PA")

    if original_ext == ".png" or has_alpha:
        out_format = "PNG"
        media_type = "image/png"
        ext = ".png"
    elif original_ext == ".webp":
        out_format = "WEBP"
        media_type = "image/webp"
        ext = ".webp"
    else:
        out_format = "JPEG"
        media_type = "image/jpeg"
        ext = ".jpg"
        if has_alpha:
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

    buf = io.BytesIO()
    save_kwargs = {"format": out_format, "optimize": True}
    if out_format in ("JPEG", "WEBP"):
        save_kwargs["quality"] = 95
    img.save(buf, **save_kwargs)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="upscaled_{scale}x{ext}"',
            "X-Original-Width": str(orig_w),
            "X-Original-Height": str(orig_h),
            "X-Output-Width": str(out_w),
            "X-Output-Height": str(out_h),
            "X-Scale-Factor": str(scale),
        },
    )
