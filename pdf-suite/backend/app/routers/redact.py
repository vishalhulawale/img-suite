"""PDF Redact/Mask endpoints — bounding box and keyword redaction."""

import io
import json
import base64
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from app.utils import save_upload, cleanup_files

router = APIRouter()


@router.post("/redact/preview")
async def redact_preview(
    file: UploadFile = File(..., description="PDF file"),
    dpi: int = Form(100, description="Preview DPI"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Return page images and text positions for the redaction UI."""
    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pages = []

        for i in range(doc.page_count):
            page = doc[i]
            pix = page.get_pixmap(matrix=matrix)
            img_b64 = base64.b64encode(pix.tobytes("png")).decode()
            # Use page.rect which reflects the visual (rotated) dimensions.
            # This matches what get_pixmap renders and what the frontend displays.
            visual_rect = page.rect
            pages.append({
                "page": i + 1,
                "width": visual_rect.width,
                "height": visual_rect.height,
                "image": f"data:image/png;base64,{img_b64}",
            })

        total = doc.page_count
        doc.close()
        return JSONResponse(content={"pages": pages, "total": total})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.post("/redact/search")
async def redact_search(
    file: UploadFile = File(..., description="PDF file"),
    keyword: str = Form(..., description="Text to search for"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Search for a keyword in the PDF and return bounding boxes of matches."""
    if not keyword.strip():
        raise HTTPException(status_code=400, detail="Keyword cannot be empty.")

    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)
        results = []

        for i in range(doc.page_count):
            page = doc[i]
            matches = page.search_for(keyword)
            # search_for() returns coordinates in mediabox (unrotated) space.
            # The preview image is rendered in page.rect (rotated) space.
            # Transform search results so they align with the preview image.
            rotation_matrix = ~page.derotation_matrix  # mediabox → page.rect
            for rect in matches:
                if page.rotation != 0:
                    rect = rect * rotation_matrix
                results.append({
                    "page": i + 1,
                    "x": rect.x0,
                    "y": rect.y0,
                    "width": rect.x1 - rect.x0,
                    "height": rect.y1 - rect.y0,
                })

        doc.close()
        return JSONResponse(content={"keyword": keyword, "matches": results, "count": len(results)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/redact/apply")
async def redact_apply(
    file: UploadFile = File(..., description="PDF file to redact"),
    redactions: str = Form(
        ...,
        description="JSON array of redaction areas: [{page, x, y, width, height}]",
    ),
    fill_color: str = Form("#000000", description="Hex color to fill redacted areas"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Permanently redact areas from a PDF. Text and images under redaction
    rectangles are irrecoverably removed.
    """
    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        areas = json.loads(redactions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid redactions JSON.")

    if not areas:
        raise HTTPException(status_code=400, detail="No redaction areas provided.")

    # Parse fill color
    fc = fill_color.lstrip("#")
    try:
        r, g, b = int(fc[0:2], 16) / 255, int(fc[2:4], 16) / 255, int(fc[4:6], 16) / 255
    except (ValueError, IndexError):
        r, g, b = 0, 0, 0

    try:
        doc = fitz.open(path)

        for area in areas:
            page_num = area.get("page", 1) - 1
            if page_num < 0 or page_num >= doc.page_count:
                continue

            page = doc[page_num]
            x = float(area.get("x", 0))
            y = float(area.get("y", 0))
            w = float(area.get("width", 0))
            h = float(area.get("height", 0))

            rect = fitz.Rect(x, y, x + w, y + h)

            # Frontend sends coordinates in page.rect (rotated/visual) space.
            # add_redact_annot() expects mediabox (unrotated) space.
            # Transform if the page has rotation.
            if page.rotation != 0:
                rect = rect * page.derotation_matrix  # page.rect → mediabox

            # Clip redaction rect to mediabox bounds
            rect = rect & page.mediabox
            if rect.is_empty:
                continue
            # Add a redaction annotation
            page.add_redact_annot(rect, fill=(r, g, b))

        # Apply all redactions — permanently removes content
        for i in range(doc.page_count):
            doc[i].apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE)

        buf = io.BytesIO()
        doc.save(buf, garbage=4, deflate=True)
        doc.close()
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=redacted.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redaction failed: {str(e)}")
