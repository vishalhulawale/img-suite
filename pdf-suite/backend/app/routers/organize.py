"""PDF Organize endpoints — reorder, rotate, delete, duplicate, insert pages."""

import io
import json
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from app.utils import save_upload, save_uploads, cleanup_files

router = APIRouter()


@router.post("/organize/preview")
async def organize_preview(
    file: UploadFile = File(..., description="PDF file"),
    dpi: int = Form(72, description="Thumbnail DPI"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Return page thumbnails and metadata for organizing."""
    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)
        pages = []
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)

        for i in range(doc.page_count):
            page = doc[i]
            pix = page.get_pixmap(matrix=matrix)
            import base64
            img_b64 = base64.b64encode(pix.tobytes("png")).decode()
            pages.append({
                "page": i + 1,
                "width": page.rect.width,
                "height": page.rect.height,
                "rotation": page.rotation,
                "thumbnail": f"data:image/png;base64,{img_b64}",
            })

        total = doc.page_count
        doc.close()

        return JSONResponse(content={"pages": pages, "total": total})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.post("/organize/apply")
async def organize_apply(
    file: UploadFile = File(..., description="Original PDF file"),
    operations: str = Form(..., description="JSON operations list"),
    insert_files: list[UploadFile] = File(default=[], description="Files to insert"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Apply organization operations to a PDF.

    Operations JSON format:
    [
        {"type": "reorder", "order": [3, 1, 2, 4]},           // 1-based page indices
        {"type": "rotate", "pages": [1, 3], "angle": 90},     // angle: 90, 180, 270
        {"type": "delete", "pages": [2]},                       // 1-based page numbers
        {"type": "duplicate", "page": 2, "after": 3},          // duplicate page 2, place after 3
        {"type": "insert", "file_index": 0, "after": 2},       // insert from uploaded file, after page 2
    ]
    """
    path = await save_upload(file)
    insert_paths = []
    if insert_files:
        insert_paths = await save_uploads(insert_files)
    background_tasks.add_task(cleanup_files, path, *insert_paths)

    try:
        ops = json.loads(operations)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid operations JSON.")

    try:
        doc = fitz.open(path)

        for op in ops:
            op_type = op.get("type")

            if op_type == "reorder":
                order = op.get("order", [])
                # Convert 1-based to 0-based
                zero_order = [p - 1 for p in order if 0 < p <= doc.page_count]
                doc.select(zero_order)

            elif op_type == "rotate":
                pages = op.get("pages", [])
                angle = op.get("angle", 90)
                for p in pages:
                    if 0 < p <= doc.page_count:
                        page = doc[p - 1]
                        page.set_rotation((page.rotation + angle) % 360)

            elif op_type == "delete":
                pages = sorted(op.get("pages", []), reverse=True)
                for p in pages:
                    if 0 < p <= doc.page_count:
                        doc.delete_page(p - 1)

            elif op_type == "duplicate":
                src_page = op.get("page", 1) - 1
                after = op.get("after", doc.page_count)
                if 0 <= src_page < doc.page_count:
                    # Copy page
                    doc.copy_page(src_page, after)

            elif op_type == "insert":
                file_index = op.get("file_index", 0)
                after = op.get("after", doc.page_count) - 1
                if 0 <= file_index < len(insert_paths):
                    insert_doc = fitz.open(insert_paths[file_index])
                    doc.insert_pdf(insert_doc, start_at=after + 1)
                    insert_doc.close()

        buf = io.BytesIO()
        doc.save(buf, garbage=4, deflate=True)
        doc.close()
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=organized.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Organize failed: {str(e)}")
