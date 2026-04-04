"""Shared utilities for SmartImageSuite backend."""

import os
import uuid
import tempfile
from typing import List
from fastapi import UploadFile, HTTPException

TEMP_DIR = os.path.join(tempfile.gettempdir(), "img_suite_temp")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB per file
ALLOWED_IMAGE_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"}
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif"}


def get_temp_path(ext: str = ".png") -> str:
    """Generate a unique temporary file path."""
    os.makedirs(TEMP_DIR, exist_ok=True)
    return os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}{ext}")


async def save_upload(upload: UploadFile, allowed_mimes: set = None) -> str:
    """Save an uploaded file to temp dir after validation. Returns file path."""
    if allowed_mimes is None:
        allowed_mimes = ALLOWED_IMAGE_MIME

    content_type = upload.content_type or ""
    ext = os.path.splitext(upload.filename or "")[1].lower()

    if content_type not in allowed_mimes and ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {content_type}. Expected image file (PNG, JPG, JPEG, WebP, AVIF).",
        )

    data = await upload.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50 MB.")

    if not ext:
        ext = ".png"
    path = get_temp_path(ext)
    with open(path, "wb") as f:
        f.write(data)
    return path


async def save_uploads(uploads: List[UploadFile], allowed_mimes: set = None) -> List[str]:
    """Save multiple uploaded files."""
    paths = []
    for upload in uploads:
        paths.append(await save_upload(upload, allowed_mimes))
    return paths


def cleanup_files(*paths: str):
    """Remove temporary files."""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass
