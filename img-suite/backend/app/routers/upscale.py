"""Image upscaler endpoint — Real super-resolution with FSRCNN (CPU-friendly)."""

import io
import os
import logging
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image, ImageFilter, ImageOps

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_OUTPUT_PIXELS = 4096 * 4096  # ~16 MP safety limit

MODELS_DIR = Path(tempfile.gettempdir()) / "img_suite_sr_models"

# FSRCNN models from the author who contributed dnn_superres to OpenCV
MODEL_URLS = {
    2: "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x2.pb",
    4: "https://raw.githubusercontent.com/Saafke/FSRCNN_Tensorflow/master/models/FSRCNN_x4.pb",
}

_sr_cache: dict = {}


def _get_sr_model(scale: int):
    """Load or return cached super-resolution model for the given scale."""
    if scale in _sr_cache:
        return _sr_cache[scale]

    try:
        import cv2  # noqa: F811

        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        model_path = MODELS_DIR / f"FSRCNN_x{scale}.pb"

        if not model_path.exists():
            logger.info("Downloading FSRCNN x%d model to %s …", scale, model_path)
            urllib.request.urlretrieve(MODEL_URLS[scale], str(model_path))  # noqa: S310
            logger.info("Model downloaded successfully.")

        sr = cv2.dnn_superres.DnnSuperResImpl_create()
        sr.readModel(str(model_path))
        sr.setModel("fsrcnn", scale)
        _sr_cache[scale] = sr
        logger.info("FSRCNN x%d model loaded.", scale)
        return sr
    except Exception as exc:
        logger.warning("Super-resolution model unavailable (%s). Falling back to Lanczos.", exc)
        return None


def _sr_upscale(img: Image.Image, scale: int) -> Image.Image:
    """Attempt neural super-resolution; fall back to Lanczos + sharpening."""
    sr = _get_sr_model(scale)
    if sr is None:
        return _lanczos_upscale(img, scale)

    try:
        import cv2

        has_alpha = img.mode in ("RGBA", "LA", "PA")

        if has_alpha:
            img_rgba = img.convert("RGBA")
            r, g, b, a = img_rgba.split()
            rgb = Image.merge("RGB", (r, g, b))
        else:
            rgb = img.convert("RGB")
            a = None

        # Convert to BGR numpy array for OpenCV
        arr = np.array(rgb)[:, :, ::-1]
        result = sr.upsample(arr)
        # Convert back to RGB PIL
        result_rgb = Image.fromarray(result[:, :, ::-1])

        if a is not None:
            # Upscale alpha channel with Lanczos
            new_size = result_rgb.size
            a_up = a.resize(new_size, Image.LANCZOS)
            result_rgba = result_rgb.copy()
            result_rgba.putalpha(a_up)
            return result_rgba

        return result_rgb
    except Exception as exc:
        logger.warning("Super-resolution inference failed (%s). Falling back to Lanczos.", exc)
        return _lanczos_upscale(img, scale)


def _lanczos_upscale(img: Image.Image, scale: int) -> Image.Image:
    """Fallback: Lanczos resize + sharpening."""
    new_w = img.size[0] * scale
    new_h = img.size[1] * scale
    img = img.resize((new_w, new_h), Image.LANCZOS)
    if scale == 2:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=100, threshold=1))
    else:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=120, threshold=1))
        img = img.filter(ImageFilter.UnsharpMask(radius=0.5, percent=50, threshold=2))
    return img


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

    # Apply EXIF orientation so dimensions are correct
    img = ImageOps.exif_transpose(img)

    # Ensure compatible mode early — CMYK, palette, etc. can cause issues
    if img.mode in ("RGBA", "LA", "PA"):
        pass  # already has alpha, keep it
    elif img.mode != "RGB":
        img = img.convert("RGB")

    orig_w, orig_h = img.size
    new_w = orig_w * scale
    new_h = orig_h * scale

    if new_w * new_h > MAX_OUTPUT_PIXELS:
        raise HTTPException(
            status_code=400,
            detail=f"Output would be {new_w}×{new_h} ({new_w * new_h // 1_000_000}MP). "
                   f"Maximum output is ~16 MP. Try a smaller image or lower scale.",
        )

    # Real super-resolution (with automatic fallback)
    img = _sr_upscale(img, scale)

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
    elif original_ext == ".avif":
        out_format = "AVIF"
        media_type = "image/avif"
        ext = ".avif"
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
    elif out_format == "AVIF":
        save_kwargs = {"format": "AVIF", "quality": 80}
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
