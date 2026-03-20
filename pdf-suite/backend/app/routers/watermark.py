"""Watermark PDF endpoint."""

import io
import base64
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional

from app.utils import save_upload, cleanup_files, ALLOWED_IMAGE_MIME, ALLOWED_PDF_MIME

router = APIRouter()

POSITION_MAP = {
    "center": (0.5, 0.5),
    "diagonal": (0.5, 0.5),
    "top-left": (0.1, 0.1),
    "top-right": (0.9, 0.1),
    "bottom-left": (0.1, 0.9),
    "bottom-right": (0.9, 0.9),
}


def _apply_text_watermark(page, text, font_size, rotation, opacity, pos_x, pos_y, r, g, b):
    """Apply a text watermark to a page using Shape (supports opacity natively)."""
    rect = page.rect
    font = fitz.Font("helv")
    text_width = font.text_length(text, fontsize=font_size)

    insert_x = rect.width * pos_x - text_width / 2
    insert_y = rect.height * pos_y + font_size / 2

    center = fitz.Point(rect.width * pos_x, rect.height * pos_y)
    morph = (center, fitz.Matrix(rotation)) if abs(rotation) > 0 else None

    shape = page.new_shape()
    shape.insert_text(
        fitz.Point(insert_x, insert_y),
        text,
        fontsize=font_size,
        fontname="helv",
        color=(r, g, b),
        morph=morph,
        stroke_opacity=opacity,
        fill_opacity=opacity,
    )
    shape.commit(overlay=True)


def _apply_image_watermark(page, image_path, image_scale, opacity, pos_x, pos_y):
    """Apply an image watermark to a page with opacity via alpha-channel pixmap."""
    rect = page.rect
    img_rect_width = rect.width * image_scale
    img_rect_height = rect.height * image_scale

    cx = rect.width * pos_x
    cy = rect.height * pos_y

    img_rect = fitz.Rect(
        cx - img_rect_width / 2,
        cy - img_rect_height / 2,
        cx + img_rect_width / 2,
        cy + img_rect_height / 2,
    )

    if opacity < 1.0:
        # Load image and apply opacity via alpha channel
        src_pix = fitz.Pixmap(image_path)
        if not src_pix.alpha:
            src_pix = fitz.Pixmap(src_pix, 1)  # add alpha channel

        alpha_val = int(opacity * 255)
        samples = bytearray(src_pix.samples)
        n = src_pix.n  # components per pixel (e.g. 4 for RGBA)
        for i in range(n - 1, len(samples), n):
            # Scale existing alpha by desired opacity
            samples[i] = min(255, int(samples[i] * opacity))

        import ctypes
        new_pix = fitz.Pixmap(src_pix.colorspace, src_pix.irect, src_pix.alpha)
        ctypes.memmove(new_pix.samples_ptr, bytes(samples), len(samples))

        page.insert_image(img_rect, pixmap=new_pix, overlay=True)
    else:
        page.insert_image(img_rect, filename=image_path, overlay=True)


def _parse_page_indices(pages_str, total_pages):
    """Parse a page selection string into 0-based indices."""
    if pages_str.strip().lower() == "all":
        return list(range(total_pages))
    page_indices = []
    for p in pages_str.split(","):
        p = p.strip()
        if "-" in p:
            start, end = p.split("-", 1)
            page_indices.extend(range(int(start) - 1, int(end)))
        else:
            page_indices.append(int(p) - 1)
    return [p for p in page_indices if 0 <= p < total_pages]


def _parse_hex_color(color):
    """Parse hex color string to (r, g, b) floats 0..1."""
    hex_color = color.lstrip("#")
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return r, g, b


@router.post("/watermark/preview")
async def watermark_preview(
    file: UploadFile = File(..., description="PDF file"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Get first page of the PDF as an image for preview."""
    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)
        page = doc[0]

        dpi = 150
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes(output="png")
        b64 = base64.b64encode(img_data).decode("utf-8")

        result = {
            "width": page.rect.width,
            "height": page.rect.height,
            "image": b64,
            "totalPages": doc.page_count,
        }

        doc.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.post("/watermark")
async def add_watermark(
    file: UploadFile = File(..., description="PDF file"),
    watermark_type: str = Form("text", description="Watermark type: text or image"),
    text: Optional[str] = Form(None, description="Watermark text"),
    font_size: int = Form(48, description="Font size for text watermark"),
    rotation: float = Form(-45, description="Rotation angle in degrees"),
    opacity: float = Form(0.3, description="Opacity (0.0 - 1.0)"),
    position: str = Form("center", description="Position: center, diagonal, top-left, top-right, bottom-left, bottom-right"),
    color: str = Form("#888888", description="Text color in hex"),
    pages: str = Form("all", description="Page selection: 'all' or comma-separated page numbers"),
    watermark_image: Optional[UploadFile] = File(None, description="Watermark image file"),
    image_scale: float = Form(0.3, description="Scale for image watermark (0.05 - 1.0, fraction of page width)"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Add a text or image watermark to a PDF."""
    if watermark_type == "text" and not text:
        raise HTTPException(status_code=400, detail="Text is required for text watermark.")
    if watermark_type == "image" and watermark_image is None:
        raise HTTPException(status_code=400, detail="Image file is required for image watermark.")

    if position not in POSITION_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid position. Choose from: {list(POSITION_MAP.keys())}")

    opacity = max(0.0, min(1.0, opacity))
    image_scale = max(0.05, min(1.0, image_scale))

    path = await save_upload(file)
    files_to_clean = [path]

    image_path = None
    if watermark_type == "image" and watermark_image:
        image_path = await save_upload(watermark_image, ALLOWED_IMAGE_MIME | ALLOWED_PDF_MIME)
        files_to_clean.append(image_path)

    background_tasks.add_task(cleanup_files, *files_to_clean)

    try:
        doc = fitz.open(path)
        page_indices = _parse_page_indices(pages, doc.page_count)
        r, g, b = _parse_hex_color(color)

        for page_idx in page_indices:
            page = doc[page_idx]
            pos_x, pos_y = POSITION_MAP[position]

            if watermark_type == "text":
                _apply_text_watermark(page, text, font_size, rotation, opacity, pos_x, pos_y, r, g, b)

            elif watermark_type == "image" and image_path:
                _apply_image_watermark(page, image_path, image_scale, opacity, pos_x, pos_y)

        buf = io.BytesIO()
        doc.save(buf)
        doc.close()
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=watermarked.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Watermark failed: {str(e)}")
