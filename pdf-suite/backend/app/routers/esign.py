"""eSign PDF endpoint."""

import io
import json
import base64
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME, ALLOWED_PDF_MIME

router = APIRouter()


@router.post("/esign")
async def esign_pdf(
    file: UploadFile = File(..., description="PDF file to sign"),
    signatures: str = Form(..., description="JSON array of signature placements"),
    signature_images: Optional[List[UploadFile]] = File(None, description="Signature image files"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Add signatures to a PDF.
    
    The `signatures` parameter is a JSON array with objects like:
    {
        "type": "draw" | "image" | "text",
        "page": 1,
        "x": 100,
        "y": 400,
        "width": 200,
        "height": 60,
        "data": "<base64 image data for draw type or text content for text type>",
        "imageIndex": 0,  // index into signature_images array for image type
        "fontFamily": "Helvetica",
        "fontSize": 24,
        "color": "#000000"
    }
    """
    path = await save_upload(file)
    files_to_clean = [path]

    # Save signature images if provided
    image_paths = []
    if signature_images:
        for img in signature_images:
            img_path = await save_upload(img, ALLOWED_IMAGE_MIME)
            image_paths.append(img_path)
            files_to_clean.append(img_path)

    background_tasks.add_task(cleanup_files, *files_to_clean)

    try:
        sig_list = json.loads(signatures)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid signatures JSON.")

    if not sig_list:
        raise HTTPException(status_code=400, detail="At least one signature is required.")

    try:
        doc = fitz.open(path)

        for sig in sig_list:
            sig_type = sig.get("type", "draw")
            page_num = sig.get("page", 1) - 1  # Convert to 0-indexed
            x = float(sig.get("x", 0))
            y = float(sig.get("y", 0))
            width = float(sig.get("width", 200))
            height = float(sig.get("height", 60))

            if page_num < 0 or page_num >= doc.page_count:
                raise HTTPException(
                    status_code=400,
                    detail=f"Page {page_num + 1} out of range."
                )

            page = doc[page_num]
            sig_rect = fitz.Rect(x, y, x + width, y + height)

            if sig_type == "draw":
                # Base64-encoded PNG image data
                data = sig.get("data", "")
                if not data:
                    continue
                # Strip data URL prefix if present
                if "," in data:
                    data = data.split(",", 1)[1]
                img_bytes = base64.b64decode(data)
                page.insert_image(sig_rect, stream=img_bytes, overlay=True)

            elif sig_type == "image":
                img_index = sig.get("imageIndex", 0)
                if img_index < 0 or img_index >= len(image_paths):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Signature image index {img_index} not found."
                    )
                page.insert_image(sig_rect, filename=image_paths[img_index], overlay=True)

            elif sig_type == "text":
                text = sig.get("data", "Signature")
                font_size = sig.get("fontSize", 24)
                color_hex = sig.get("color", "#000000").lstrip("#")
                r = int(color_hex[0:2], 16) / 255
                g = int(color_hex[2:4], 16) / 255
                b = int(color_hex[4:6], 16) / 255

                # Choose a cursive-style font
                font_name = sig.get("fontFamily", "helv")
                # Map common names
                font_map = {
                    "Helvetica": "helv",
                    "Times": "tiro",
                    "Courier": "cour",
                    "cursive": "helv",
                }
                fitz_font = font_map.get(font_name, "helv")

                page.insert_text(
                    fitz.Point(x, y + height * 0.7),  # Baseline offset
                    text,
                    fontname=fitz_font,
                    fontsize=font_size,
                    color=(r, g, b),
                    overlay=True,
                )
            else:
                raise HTTPException(status_code=400, detail=f"Unknown signature type: {sig_type}")

        buf = io.BytesIO()
        doc.save(buf)
        doc.close()
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=signed.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"eSign failed: {str(e)}")


@router.post("/esign/preview")
async def preview_pdf_pages(
    file: UploadFile = File(..., description="PDF file to preview"),
    dpi: int = Form(100, description="Preview resolution"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Get page images for signature placement preview."""
    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)
        pages_data = []

        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)

        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=matrix)
            img_data = pix.tobytes(output="png")
            b64 = base64.b64encode(img_data).decode("utf-8")
            pages_data.append({
                "page": i + 1,
                "width": page.rect.width,
                "height": page.rect.height,
                "image": f"data:image/png;base64,{b64}",
            })

        doc.close()

        return {"pages": pages_data, "total": len(pages_data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")
