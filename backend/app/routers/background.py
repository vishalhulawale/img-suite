"""Background removal endpoint using rembg (CPU, ONNX)."""

import io
import logging
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image
from rembg import remove

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME

logger = logging.getLogger(__name__)

router = APIRouter()

# Images larger than this (in total pixels) are downscaled before bg removal
# to avoid memory exhaustion in alpha-matting / onnxruntime.
_MAX_PIXELS_FOR_REMBG = 2048 * 2048


def _remove_bg(img: Image.Image) -> Image.Image:
    """Run rembg on *img*, downscaling first if it is too large.

    If the image exceeds _MAX_PIXELS_FOR_REMBG pixels the workflow is:
    1. Downscale to fit within the budget (preserving aspect ratio).
    2. Run rembg on the smaller copy to obtain an alpha mask.
    3. Upscale the alpha mask back to the original size (bicubic).
    4. Composite the mask onto the original full-resolution image.
    """
    orig_w, orig_h = img.size
    total_pixels = orig_w * orig_h
    needs_downscale = total_pixels > _MAX_PIXELS_FOR_REMBG

    if needs_downscale:
        scale = (_MAX_PIXELS_FOR_REMBG / total_pixels) ** 0.5
        small_w = max(1, int(orig_w * scale))
        small_h = max(1, int(orig_h * scale))
        small_img = img.resize((small_w, small_h), Image.LANCZOS)
        logger.info(
            "Downscaling %dx%d -> %dx%d for background removal",
            orig_w, orig_h, small_w, small_h,
        )
    else:
        small_img = img

    # Run rembg (with alpha-matting first, fallback without)
    try:
        result_small = remove(
            small_img,
            alpha_matting=True,
            alpha_matting_foreground_threshold=230,
            alpha_matting_background_threshold=20,
            alpha_matting_erode_size=10,
            post_process_mask=True,
        )
    except Exception:
        try:
            result_small = remove(small_img, post_process_mask=True)
        except Exception:
            logger.exception("Background removal failed")
            raise

    if not needs_downscale:
        return result_small

    # Upscale the alpha channel back to the original resolution
    alpha_small = result_small.split()[-1]  # A channel from RGBA
    alpha_full = alpha_small.resize((orig_w, orig_h), Image.LANCZOS)

    # Ensure original is RGBA, then replace alpha
    orig_rgba = img.convert("RGBA")
    orig_rgba.putalpha(alpha_full)
    return orig_rgba


@router.post("/remove-background")
async def remove_background(
    file: UploadFile = File(..., description="Image file for background removal"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Remove background from an image. Returns PNG with transparency."""
    path = await save_upload(file, ALLOWED_IMAGE_MIME)
    background_tasks.add_task(cleanup_files, path)

    try:
        img = Image.open(path)
        img.load()
    except Exception:
        logger.exception("Failed to open image file")
        raise HTTPException(status_code=400, detail="Could not open image file.")

    try:
        result = _remove_bg(img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {str(e)}")

    buf = io.BytesIO()
    result.save(buf, format="PNG", optimize=True)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={
            "Content-Disposition": 'attachment; filename="no-background.png"',
        },
    )
