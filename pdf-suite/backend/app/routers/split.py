"""Split PDF endpoint."""

import io
import zipfile
import json
import fitz  # PyMuPDF
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from app.utils import save_upload, cleanup_files

router = APIRouter()


def parse_page_ranges(range_str: str, total_pages: int) -> list[list[int]]:
    """Parse page range string like '1-5,6-10' into list of page lists.
    Pages are 1-indexed in input, converted to 0-indexed for PyMuPDF.
    """
    groups = []
    for part in range_str.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            start = max(1, int(start.strip()))
            end = min(total_pages, int(end.strip()))
            if start > end:
                raise ValueError(f"Invalid range: {part}")
            groups.append(list(range(start - 1, end)))
        else:
            page = int(part.strip())
            if page < 1 or page > total_pages:
                raise ValueError(f"Page {page} out of range (1-{total_pages})")
            groups.append([page - 1])
    return groups


@router.post("/split")
async def split_pdf(
    file: UploadFile = File(..., description="PDF file to split"),
    mode: str = Form("ranges", description="Split mode: 'ranges', 'extract', 'individual'"),
    pages: str = Form("", description="Page ranges (e.g. '1-5,6-10') or page numbers (e.g. '1,3,5')"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Split a PDF by page ranges, extract specific pages, or split into individual pages."""
    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)

    try:
        doc = fitz.open(path)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open PDF file.")

    total = doc.page_count

    try:
        if mode == "individual":
            # Split into individual pages
            page_groups = [[i] for i in range(total)]
        elif mode == "extract":
            # Extract specific pages
            if not pages:
                raise HTTPException(status_code=400, detail="Specify pages to extract.")
            page_nums = []
            for p in pages.split(","):
                p = p.strip()
                if "-" in p:
                    start, end = p.split("-", 1)
                    page_nums.extend(range(int(start.strip()) - 1, int(end.strip())))
                else:
                    page_nums.append(int(p) - 1)
            # Validate
            for pn in page_nums:
                if pn < 0 or pn >= total:
                    raise HTTPException(status_code=400, detail=f"Page {pn+1} out of range.")
            page_groups = [page_nums]
        elif mode == "ranges":
            if not pages:
                raise HTTPException(status_code=400, detail="Specify page ranges.")
            page_groups = parse_page_ranges(pages, total)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

        # Generate PDFs
        pdfs = []
        for i, group in enumerate(page_groups):
            new_doc = fitz.open()
            for page_num in group:
                new_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
            buf = io.BytesIO()
            new_doc.save(buf)
            new_doc.close()
            buf.seek(0)
            pdfs.append((f"split_{i + 1}.pdf", buf))

        doc.close()

        if len(pdfs) == 1:
            name, buf = pdfs[0]
            return StreamingResponse(
                buf,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={name}"},
            )
        else:
            # Zip multiple PDFs
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for name, buf in pdfs:
                    zf.writestr(name, buf.read())
            zip_buf.seek(0)
            return StreamingResponse(
                zip_buf,
                media_type="application/zip",
                headers={"Content-Disposition": "attachment; filename=split_pages.zip"},
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Split failed: {str(e)}")
