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
        result = remove(
            img,
            alpha_matting=True,
            alpha_matting_foreground_threshold=230,
            alpha_matting_background_threshold=20,
            alpha_matting_erode_size=10,
            post_process_mask=True,
        )
    except Exception:
        # Fallback: try without alpha-matting if it fails (e.g. small images)
        try:
            result = remove(img, post_process_mask=True)
        except Exception as e:
            logger.exception("Background removal failed")
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
