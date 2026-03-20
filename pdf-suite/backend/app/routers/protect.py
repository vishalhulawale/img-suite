"""PDF Protection endpoints — password protection & encryption."""

import io
import secrets
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from app.utils import save_upload, cleanup_files

router = APIRouter()

# PyMuPDF permission flags — these map to the standard PDF permission bits.
# Reference: PDF Spec §7.6.3.2 Table 22
PERM_PRINT            = fitz.PDF_PERM_PRINT            # bit 3 — printing
PERM_MODIFY           = fitz.PDF_PERM_MODIFY           # bit 4 — modify contents
PERM_COPY             = fitz.PDF_PERM_COPY             # bit 5 — copy/extract text
PERM_ANNOTATE         = fitz.PDF_PERM_ANNOTATE         # bit 6 — add/modify annotations
PERM_FORM             = fitz.PDF_PERM_FORM             # bit 9 — fill in forms
PERM_ACCESSIBILITY    = fitz.PDF_PERM_ACCESSIBILITY    # bit 10 — extract for accessibility
PERM_ASSEMBLE         = fitz.PDF_PERM_ASSEMBLE         # bit 11 — assemble (insert/rotate/delete pages)
PERM_PRINT_HQ         = fitz.PDF_PERM_PRINT_HQ         # bit 12 — high-quality print


# ─── Shared helper: check if a PDF is encrypted ───────────────────
@router.post("/pdf/check-encrypted")
async def check_pdf_encrypted(
    file: UploadFile = File(..., description="PDF to check"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Return whether a PDF file is encrypted."""
    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)
    try:
        doc = fitz.open(path)
        encrypted = doc.is_encrypted
        doc.close()
        return {"encrypted": encrypted}
    except Exception:
        return {"encrypted": False}


@router.post("/protect")
async def protect_pdf(
    file: UploadFile = File(..., description="PDF file to protect"),
    user_password: str = Form(..., description="Password required to open the PDF"),
    owner_password: str = Form("", description="Owner password for editing permissions"),
    allow_print: bool = Form(True, description="Allow printing"),
    allow_copy: bool = Form(True, description="Allow copying text"),
    allow_modify: bool = Form(False, description="Allow modifying content"),
    allow_annotate: bool = Form(True, description="Allow annotations"),
    encryption: str = Form("AES-256", description="Encryption algorithm"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Encrypt a PDF with password protection and permission restrictions."""
    if not user_password:
        raise HTTPException(status_code=400, detail="User password is required.")

    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)

        # Reject already-encrypted PDFs with a clear client error
        if doc.is_encrypted:
            doc.close()
            raise HTTPException(
                status_code=409,
                detail="This PDF is already password-protected. Remove the existing password first using the Unlock tool before re-protecting.",
            )

        # Build permission flags — start with no permissions granted,
        # then add only what the user explicitly allows.
        perm = 0

        if allow_print:
            perm |= PERM_PRINT | PERM_PRINT_HQ

        if allow_copy:
            perm |= PERM_COPY | PERM_ACCESSIBILITY

        if allow_modify:
            perm |= PERM_MODIFY | PERM_ASSEMBLE

        if allow_annotate:
            perm |= PERM_ANNOTATE | PERM_FORM

        # Map encryption name to PyMuPDF constant
        enc_map = {
            "AES-256": fitz.PDF_ENCRYPT_AES_256,
            "AES-128": fitz.PDF_ENCRYPT_AES_128,
            "RC4-128": fitz.PDF_ENCRYPT_RC4_128,
        }
        enc_method = enc_map.get(encryption, fitz.PDF_ENCRYPT_AES_256)

        owner_pwd = owner_password if owner_password and owner_password != user_password else secrets.token_urlsafe(24)

        buf = io.BytesIO()
        doc.save(
            buf,
            encryption=enc_method,
            user_pw=user_password,
            owner_pw=owner_pwd,
            permissions=perm,
            garbage=4,
            deflate=True,
        )
        doc.close()
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=protected.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Protection failed: {str(e)}")
