"""Shared utilities for SmartPDFSuite backend."""

import os
import uuid
import tempfile
from typing import List
from fastapi import UploadFile, HTTPException

TEMP_DIR = os.path.join(tempfile.gettempdir(), "pdf_suite_temp")
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB per file
ALLOWED_PDF_MIME = {"application/pdf"}
ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
ALLOWED_OFFICE_MIME = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   # .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",          # .xlsx
}
ALLOWED_CONVERTIBLE_MIME = ALLOWED_PDF_MIME | ALLOWED_IMAGE_MIME | ALLOWED_OFFICE_MIME


def get_temp_path(ext: str = ".pdf") -> str:
    """Generate a unique temporary file path."""
    os.makedirs(TEMP_DIR, exist_ok=True)
    return os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}{ext}")


async def save_upload(upload: UploadFile, allowed_mimes: set = None) -> str:
    """Save an uploaded file to temp dir after validation. Returns file path."""
    if allowed_mimes is None:
        allowed_mimes = ALLOWED_PDF_MIME

    content_type = upload.content_type or ""
    # Also check extension as fallback
    ext = os.path.splitext(upload.filename or "")[1].lower()

    if content_type not in allowed_mimes:
        # Fallback: check by extension
        if ext == ".pdf" and "application/pdf" in allowed_mimes:
            pass
        elif ext in (".png", ".jpg", ".jpeg", ".webp") and allowed_mimes & ALLOWED_IMAGE_MIME:
            pass
        elif ext in (".docx", ".pptx", ".xlsx") and allowed_mimes & ALLOWED_OFFICE_MIME:
            pass
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {content_type}. Expected: {allowed_mimes}",
            )

    data = await upload.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 100 MB.")

    if "application/pdf" in allowed_mimes and ext == ".pdf":
        # Quick PDF header check
        if not data[:5] == b"%PDF-":
            raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF.")

    path = get_temp_path(ext if ext else ".pdf")
    with open(path, "wb") as f:
        f.write(data)
    return path


async def save_uploads(uploads: List[UploadFile], allowed_mimes: set = None) -> List[str]:
    """Save multiple uploads and return paths."""
    paths = []
    for upload in uploads:
        paths.append(await save_upload(upload, allowed_mimes))
    return paths


def cleanup_files(*paths: str):
    """Delete temporary files."""
    for p in paths:
        try:
            if p and os.path.exists(p):
                os.unlink(p)
        except OSError:
            pass


def cleanup_dir(dirpath: str):
    """Delete a temporary directory."""
    import shutil
    try:
        if dirpath and os.path.exists(dirpath):
            shutil.rmtree(dirpath, ignore_errors=True)
    except OSError:
        pass
