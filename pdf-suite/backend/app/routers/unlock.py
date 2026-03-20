"""PDF Unlock endpoints — remove password protection."""

import io
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from app.utils import save_upload, cleanup_files

router = APIRouter()


@router.post("/unlock")
async def unlock_pdf(
    file: UploadFile = File(..., description="Password-protected PDF"),
    password: str = Form(..., description="Password to unlock the PDF"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Remove password protection from a PDF."""
    if not password:
        raise HTTPException(status_code=400, detail="Password is required.")

    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)

        # Check if the document is actually encrypted
        if not doc.is_encrypted:
            doc.close()
            raise HTTPException(
                status_code=400,
                detail="This PDF is not password-protected.",
            )

        # Try to authenticate with the provided password
        if not doc.authenticate(password):
            doc.close()
            raise HTTPException(
                status_code=401,
                detail="Incorrect password. Please try again.",
            )

        buf = io.BytesIO()
        # Save without encryption
        doc.save(buf, garbage=4, deflate=True)
        doc.close()
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=unlocked.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unlock failed: {str(e)}")
