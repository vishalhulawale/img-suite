"""Merge PDF endpoint."""

import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List
import io

from app.utils import save_uploads, cleanup_files

router = APIRouter()


@router.post("/merge")
async def merge_pdfs(
    files: List[UploadFile] = File(..., description="PDF files to merge (in order)"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Merge multiple PDF files into one."""
    if len(files) < 2:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="At least 2 PDF files are required.")

    paths = await save_uploads(files)
    background_tasks.add_task(cleanup_files, *paths)

    try:
        merged = fitz.open()
        for path in paths:
            try:
                doc = fitz.open(path)
            except Exception:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail=f"Could not open PDF: {path.split('/')[-1]}")
            merged.insert_pdf(doc)
            doc.close()

        buf = io.BytesIO()
        merged.save(buf)
        merged.close()
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=merged.pdf"},
        )
    except Exception as e:
        if "HTTPException" in type(e).__name__:
            raise
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(e)}")
