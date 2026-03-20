"""Crop and resize endpoint."""

import io
import os
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

router = APIRouter()


@router.post("/crop-resize")
async def crop_resize(
    file: UploadFile = File(...),
    crop_x: int = Form(0),
    crop_y: int = Form(0),
    crop_w: int = Form(0),
    crop_h: int = Form(0),
    resize_w: int = Form(0),
    resize_h: int = Form(0),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open image file.")

    orig_w, orig_h = img.size

    # Apply crop if specified
    if crop_w > 0 and crop_h > 0:
        # Clamp crop region to image bounds
        cx = max(0, min(crop_x, orig_w - 1))
        cy = max(0, min(crop_y, orig_h - 1))
        cw = min(crop_w, orig_w - cx)
        ch = min(crop_h, orig_h - cy)

        if cw < 1 or ch < 1:
            raise HTTPException(status_code=400, detail="Crop region is invalid.")

        img = img.crop((cx, cy, cx + cw, cy + ch))

    # Apply resize if specified
    if resize_w > 0 and resize_h > 0:
        resize_w = min(resize_w, 8000)
        resize_h = min(resize_h, 8000)
        img = img.resize((resize_w, resize_h), Image.LANCZOS)
    elif resize_w > 0:
        ratio = resize_w / img.width
        resize_h = max(1, int(img.height * ratio))
        resize_w = min(resize_w, 8000)
        img = img.resize((resize_w, resize_h), Image.LANCZOS)
    elif resize_h > 0:
        ratio = resize_h / img.height
        resize_w = max(1, int(img.width * ratio))
        resize_h = min(resize_h, 8000)
        img = img.resize((resize_w, resize_h), Image.LANCZOS)

    out_w, out_h = img.size

    # Determine output format based on original
    original_ext = os.path.splitext(file.filename or "")[1].lower()
    if original_ext in (".png",) and img.mode in ("RGBA", "LA", "PA"):
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
        if img.mode in ("RGBA", "LA", "PA"):
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
            "Content-Disposition": f'attachment; filename="cropped{ext}"',
            "X-Original-Width": str(orig_w),
            "X-Original-Height": str(orig_h),
            "X-Output-Width": str(out_w),
            "X-Output-Height": str(out_h),
        },
    )
