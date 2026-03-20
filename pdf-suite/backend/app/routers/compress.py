"""Compress PDF endpoint – transparency-preserving pipeline.

Root cause of the previous black-background bug:
1. All images (including transparent ones) were composited onto white/black
   and converted to JPEG, which cannot carry alpha channels.
2. ``page.replace_image()`` rewrites the image dictionary, silently
   dropping the /SMask reference.  The image becomes fully opaque.
3. ``fitz.Pixmap(fitz.csRGB, pix, 0)`` drops alpha – transparent pixels
   whose underlying color data is (0,0,0,0) become solid black.

Fixed pipeline:
  • Opaque images  → JPEG compress (quality + scale)
  • Embedded-alpha → Flate downscale only, alpha preserved
  • Separate SMask → recombine into RGBA, downscale, replace
    (PyMuPDF auto-splits back into image + SMask)
  • SMask image refs are never individually JPEG'd

Performance optimizations:
  • Classify transparency via xref_get_key (no pixel extraction)
  • Parallel image compression via ThreadPoolExecutor (PIL releases GIL)
  • Image deduplication by stream digest (skip identical images)
  • Single pixmap extraction per image (no redundant fitz.Pixmap)
"""

import io
import os
import hashlib
import logging
import fitz  # PyMuPDF
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from app.utils import save_upload, cleanup_files

router = APIRouter()
logger = logging.getLogger(__name__)
# Ensure our logs are visible even when uvicorn reconfigures the root logger
# (multi-worker mode replaces root handlers after app import).
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:%(name)s: %(message)s"))
    logger.addHandler(_handler)
logger.setLevel(logging.DEBUG)
logger.propagate = False

# Cap workers to avoid memory explosion on large PDFs.
# ThreadPoolExecutor is used instead of ProcessPoolExecutor because
# fork()-based process pools deadlock inside uvicorn workers on Linux.
# PIL image ops release the GIL, so threads still give real parallelism.
_MAX_WORKERS = min(os.cpu_count() or 2, 4)

COMPRESSION_SETTINGS = {
    "low": {        # High quality, light compression
        "deflate": True,
        "garbage": 1,
        "clean": True,
        "image_quality": 85,
        "scale_factor": 1.0,      # No downscale
    },
    "medium": {
        "deflate": True,
        "garbage": 3,
        "clean": True,
        "image_quality": 50,
        "scale_factor": 0.75,     # Downscale large images to 75 %
    },
    "high": {       # Max compression
        "deflate": True,
        "garbage": 4,
        "clean": True,
        "image_quality": 25,
        "scale_factor": 0.5,      # Downscale large images to 50 %
    },
}

# ─── Transparency detection helpers ──────────────────────────────────


def _get_smask_xref(doc: fitz.Document, xref: int) -> int:
    """Return the /SMask xref for image *xref*, or 0 if none exists."""
    try:
        kind, val = doc.xref_get_key(xref, "SMask")
        if kind == "xref":
            return int(val.split()[0])
    except Exception:
        pass
    return 0


def _has_alpha_colorspace(doc: fitz.Document, xref: int) -> bool:
    """Check if the image at *xref* would produce an alpha channel.

    Uses only xref metadata (no pixel extraction), which is ~100x faster
    than ``fitz.Pixmap(doc, xref).alpha``.
    """
    try:
        kind, val = doc.xref_get_key(xref, "SMask")
        if kind == "xref":
            return True
    except Exception:
        pass
    # ImageMask entries are 1-bit masks (alpha-like)
    try:
        kind, val = doc.xref_get_key(xref, "ImageMask")
        if kind == "bool" and val.lower() == "true":
            return True
    except Exception:
        pass
    return False


def _classify_image_fast(doc: fitz.Document, xref: int) -> dict:
    """Classify image transparency using only xref metadata.

    Avoids the expensive ``fitz.Pixmap(doc, xref)`` call that the old
    ``_image_transparency_info()`` used just to check ``.alpha``.
    """
    smask_xref = _get_smask_xref(doc, xref)
    has_smask = smask_xref > 0
    has_alpha = _has_alpha_colorspace(doc, xref) if not has_smask else False
    return {
        "has_smask": has_smask,
        "smask_xref": smask_xref,
        "has_alpha": has_alpha,
        "is_transparent": has_smask or has_alpha,
    }


def _image_stream_digest(doc: fitz.Document, xref: int) -> str | None:
    """Return a fast hash of the raw image stream for deduplication."""
    try:
        data = doc.xref_stream_raw(xref)
        if data:
            return hashlib.sha256(data).hexdigest()[:16]
    except Exception:
        pass
    return None


# ─── Mask / PIL helpers ─────────────────────────────────────────────


def _mask_pixmap_to_pil_l(mask_pix: fitz.Pixmap) -> Image.Image | None:
    """Convert any mask Pixmap to a Pillow ``'L'`` (grayscale) image."""
    try:
        w, h = mask_pix.width, mask_pix.height
        n = mask_pix.n  # total channels incl. alpha

        if n == 1:
            return Image.frombytes("L", (w, h), mask_pix.samples)
        if n == 2:  # Gray + alpha → take gray channel
            pil = Image.frombytes("LA", (w, h), mask_pix.samples)
            return pil.split()[0]
        if n == 3:
            pil = Image.frombytes("RGB", (w, h), mask_pix.samples)
            return pil.convert("L")
        if n == 4:
            mode = "RGBA" if mask_pix.alpha else "CMYK"
            pil = Image.frombytes(mode, (w, h), mask_pix.samples)
            return pil.convert("L")
        return None
    except Exception:
        return None


def _pil_to_pixmap(pil_img: Image.Image) -> fitz.Pixmap:
    """Convert a PIL image (RGB or RGBA) to a ``fitz.Pixmap``.

    Uses raw samples for RGB (fastest) and PNG for RGBA (alpha must survive).
    """
    if pil_img.mode == "RGB":
        raw = pil_img.tobytes()
        return fitz.Pixmap(
            fitz.csRGB,
            fitz.IRect(0, 0, pil_img.width, pil_img.height),
            raw,
            0,
        )
    # RGBA – need PNG intermediate for alpha
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG", compress_level=1)  # fast compression
    return fitz.Pixmap(buf.getvalue())


# ─── Compression strategies ─────────────────────────────────────────

# These ``_worker_*`` helpers accept and return plain ``bytes`` so they
# can run in a ``ProcessPoolExecutor`` (Pixmap objects are not picklable).


def _worker_compress_opaque(
    raw_samples: bytes, width: int, height: int,
    quality: int, scale_factor: float,
    original_stream_size: int = 0,
) -> bytes | None:
    """JPEG-compress opaque RGB samples. Runs in a worker process.

    If *original_stream_size* > 0, the result is discarded when it is
    not actually smaller than the original compressed stream (avoids
    inflating already-well-compressed images).
    """
    try:
        pil_rgb = Image.frombytes("RGB", (width, height), raw_samples)

        if scale_factor < 1.0:
            tw = int(pil_rgb.width * scale_factor)
            th = int(pil_rgb.height * scale_factor)
            if tw >= 32 and th >= 32:
                pil_rgb = pil_rgb.resize((tw, th), Image.LANCZOS)

        jpeg_buf = io.BytesIO()
        pil_rgb.save(jpeg_buf, format="JPEG", quality=quality, optimize=True)
        result = jpeg_buf.getvalue()

        # Don't replace if the new stream is larger than the original.
        if original_stream_size > 0 and len(result) >= original_stream_size:
            return None

        return result
    except Exception:
        return None


def _worker_downscale_alpha(
    raw_samples: bytes, width: int, height: int, n_channels: int,
    scale_factor: float,
) -> bytes | None:
    """Down-scale RGBA/LA image. Returns PNG bytes. Runs in a worker."""
    if scale_factor >= 1.0:
        return None
    try:
        tw = int(width * scale_factor)
        th = int(height * scale_factor)
        if tw < 32 or th < 32:
            return None

        mode = "LA" if n_channels == 2 else "RGBA"
        pil_img = Image.frombytes(mode, (width, height), raw_samples).convert("RGBA")
        pil_img = pil_img.resize((tw, th), Image.LANCZOS)

        png_buf = io.BytesIO()
        pil_img.save(png_buf, format="PNG", compress_level=1)
        return png_buf.getvalue()
    except Exception:
        return None


def _worker_combine_smask(
    base_samples: bytes, base_w: int, base_h: int,
    mask_samples: bytes, mask_w: int, mask_h: int, mask_n: int,
    scale_factor: float,
) -> bytes | None:
    """Merge base + mask → RGBA PNG bytes. Runs in a worker."""
    try:
        pil_rgb = Image.frombytes("RGB", (base_w, base_h), base_samples)

        # Build mask
        if mask_n == 1:
            pil_mask = Image.frombytes("L", (mask_w, mask_h), mask_samples)
        elif mask_n == 2:
            pil_mask = Image.frombytes("LA", (mask_w, mask_h), mask_samples).split()[0]
        elif mask_n == 3:
            pil_mask = Image.frombytes("RGB", (mask_w, mask_h), mask_samples).convert("L")
        elif mask_n == 4:
            pil_mask = Image.frombytes("RGBA", (mask_w, mask_h), mask_samples).convert("L")
        else:
            return None

        if pil_mask.size != (base_w, base_h):
            pil_mask = pil_mask.resize((base_w, base_h), Image.LANCZOS)

        pil_rgba = pil_rgb.copy()
        pil_rgba.putalpha(pil_mask)

        if scale_factor < 1.0:
            tw = int(base_w * scale_factor)
            th = int(base_h * scale_factor)
            if tw >= 32 and th >= 32:
                pil_rgba = pil_rgba.resize((tw, th), Image.LANCZOS)

        png_buf = io.BytesIO()
        pil_rgba.save(png_buf, format="PNG", compress_level=1)
        return png_buf.getvalue()
    except Exception:
        return None


def _compress_opaque_image(
    pix: fitz.Pixmap, quality: int, scale_factor: float,
) -> fitz.Pixmap | None:
    """JPEG-compress an opaque RGB image (single-process fallback)."""
    result = _worker_compress_opaque(
        bytes(pix.samples), pix.width, pix.height, quality, scale_factor,
    )
    if result is None:
        return None
    return fitz.Pixmap(result)


def _downscale_alpha_image(
    pix: fitz.Pixmap, scale_factor: float,
) -> fitz.Pixmap | None:
    """Down-scale with alpha (single-process fallback)."""
    result = _worker_downscale_alpha(
        bytes(pix.samples), pix.width, pix.height, pix.n, scale_factor,
    )
    if result is None:
        return None
    return fitz.Pixmap(result)


def _combine_image_with_smask(
    doc: fitz.Document,
    xref: int,
    smask_xref: int,
    scale_factor: float,
) -> fitz.Pixmap | None:
    """Merge base + SMask → RGBA (single-process fallback)."""
    try:
        base_pix = fitz.Pixmap(doc, xref)
        mask_pix = fitz.Pixmap(doc, smask_xref)
    except Exception:
        return None

    if base_pix.width < 32 or base_pix.height < 32:
        return None

    try:
        if base_pix.alpha:
            base_pix = fitz.Pixmap(fitz.csRGB, base_pix, 0)
        elif base_pix.colorspace is None or base_pix.colorspace.n != 3:
            base_pix = fitz.Pixmap(fitz.csRGB, base_pix)

        result = _worker_combine_smask(
            bytes(base_pix.samples), base_pix.width, base_pix.height,
            bytes(mask_pix.samples), mask_pix.width, mask_pix.height, mask_pix.n,
            scale_factor,
        )
        if result is None:
            return None
        return fitz.Pixmap(result)
    except Exception as exc:
        logger.debug("Failed to combine image+smask xref=%s: %s", xref, exc)
        return None


def _to_rgb_pixmap(pix: fitz.Pixmap) -> fitz.Pixmap:
    """Ensure *pix* is in the RGB colour-space (no alpha change)."""
    if pix.colorspace is not None and pix.colorspace.n == 3 and not pix.alpha:
        return pix
    return fitz.Pixmap(fitz.csRGB, pix) if not pix.alpha else fitz.Pixmap(fitz.csRGB, pix, 0)


# ─── Post-compression validation ────────────────────────────────────


def _validate_transparency_preserved(
    original_path: str, compressed_buf: io.BytesIO,
) -> list[str]:
    """Structural validation: ensure transparency artefacts survive.

    Returns a list of human-readable warnings (empty ⇒ passed).
    """
    warnings: list[str] = []
    try:
        orig = fitz.open(original_path)
        compressed_buf.seek(0)
        comp = fitz.open(stream=compressed_buf.read(), filetype="pdf")
        compressed_buf.seek(0)

        if len(orig) != len(comp):
            warnings.append(f"Page count changed: {len(orig)} -> {len(comp)}")

        # ── SMask count ──────────────────────────────────────────────
        def _count_smasks(doc: fitz.Document) -> int:
            count = 0
            for xr in range(1, doc.xref_length()):
                try:
                    kind, _ = doc.xref_get_key(xr, "SMask")
                    if kind == "xref":
                        count += 1
                except Exception:
                    pass
            return count

        orig_sm = _count_smasks(orig)
        comp_sm = _count_smasks(comp)
        if comp_sm < orig_sm:
            warnings.append(
                f"SMask count reduced: {orig_sm} -> {comp_sm} "
                "(transparency may be lost)"
            )

        # ── Transparency groups (/Group on pages) ────────────────────
        def _count_groups(doc: fitz.Document) -> int:
            count = 0
            for page in doc:
                try:
                    obj = doc.xref_object(page.xref, compressed=False)
                    if "/Group" in obj:
                        count += 1
                except Exception:
                    pass
            return count

        orig_g = _count_groups(orig)
        comp_g = _count_groups(comp)
        if comp_g < orig_g:
            warnings.append(
                f"Transparency groups reduced: {orig_g} -> {comp_g}"
            )

        orig.close()
        comp.close()
    except Exception as exc:
        warnings.append(f"Validation error: {exc}")
    return warnings


# ─── Endpoint ────────────────────────────────────────────────────────


@router.post("/compress")
async def compress_pdf(
    file: UploadFile = File(..., description="PDF file to compress"),
    level: str = Form("medium", description="Compression level: low, medium, high"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Compress a PDF file while preserving transparency and visual fidelity."""
    if level not in COMPRESSION_SETTINGS:
        raise HTTPException(status_code=400, detail="Level must be: low, medium, high")

    path = await save_upload(file)
    background_tasks.add_task(cleanup_files, path)
    original_size = os.path.getsize(path)

    settings = COMPRESSION_SETTINGS[level]

    try:
        doc = fitz.open(path)
        logger.info("Compress start: pages=%d level=%s size=%d", len(doc), level, original_size)

        # ── Phase 1: collect unique image xrefs ──────────────────────
        seen_xrefs: set[int] = set()
        for page in doc:
            for img_info in page.get_images(full=True):
                seen_xrefs.add(img_info[0])
        logger.debug("Phase 1: %d unique image xrefs", len(seen_xrefs))

        # Build set of xrefs that are themselves SMasks.
        smask_xrefs: set[int] = set()
        for xref in seen_xrefs:
            sx = _get_smask_xref(doc, xref)
            if sx > 0:
                smask_xrefs.add(sx)

        # ── Phase 2: classify (fast, metadata-only) + extract ────────
        # Pre-extract pixel data into serialisable tuples so we can
        # ship work to a process pool without touching the doc again.

        # task = (xref, kind, <kind-specific args>)
        #   kind: "opaque" | "alpha" | "smask"
        tasks: list[tuple] = []
        # Deduplication: skip xrefs whose raw stream is identical.
        seen_digests: dict[str, int] = {}  # digest → canonical xref

        for xref in seen_xrefs:
            if xref in smask_xrefs:
                continue

            info = _classify_image_fast(doc, xref)

            # Dedup: hash raw stream
            digest = _image_stream_digest(doc, xref)
            if digest is not None and digest in seen_digests:
                # Will copy replacement from canonical xref later.
                continue
            if digest is not None:
                seen_digests[digest] = xref

            if info["has_smask"]:
                if settings["scale_factor"] < 1.0:
                    try:
                        base_pix = fitz.Pixmap(doc, xref)
                        mask_pix = fitz.Pixmap(doc, info["smask_xref"])
                        if base_pix.width < 32 or base_pix.height < 32:
                            continue
                        if base_pix.alpha:
                            base_pix = fitz.Pixmap(fitz.csRGB, base_pix, 0)
                        elif base_pix.colorspace is None or base_pix.colorspace.n != 3:
                            base_pix = fitz.Pixmap(fitz.csRGB, base_pix)
                        tasks.append((
                            xref, "smask",
                            bytes(base_pix.samples), base_pix.width, base_pix.height,
                            bytes(mask_pix.samples), mask_pix.width, mask_pix.height, mask_pix.n,
                            settings["scale_factor"],
                        ))
                    except Exception as exc:
                        logger.warning("Phase 2 extract smask xref=%s failed: %s", xref, exc, exc_info=True)

            elif info["has_alpha"]:
                if settings["scale_factor"] < 1.0:
                    try:
                        pix = fitz.Pixmap(doc, xref)
                        if pix.width >= 32 and pix.height >= 32 and pix.n in (2, 4):
                            tasks.append((
                                xref, "alpha",
                                bytes(pix.samples), pix.width, pix.height, pix.n,
                                settings["scale_factor"],
                            ))
                    except Exception as exc:
                        logger.warning("Phase 2 extract alpha xref=%s failed: %s", xref, exc, exc_info=True)

            else:
                # Skip opaque re-encoding when not downscaling: the
                # Pixmap round-trip replaces the original JPEG stream
                # with raw+Flate data that is invariably larger.
                if settings["scale_factor"] >= 1.0:
                    continue
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.width < 32 or pix.height < 32:
                        continue
                    rgb_pix = _to_rgb_pixmap(pix)
                    # Grab original compressed stream size so the worker
                    # can skip replacement when JPEG re-encoding is larger.
                    orig_stream_size = 0
                    try:
                        orig_stream_size = len(doc.xref_stream_raw(xref))
                    except Exception:
                        pass
                    tasks.append((
                        xref, "opaque",
                        bytes(rgb_pix.samples), rgb_pix.width, rgb_pix.height,
                        settings["image_quality"], settings["scale_factor"],
                        orig_stream_size,
                    ))
                except Exception as exc:
                    logger.warning("Phase 2 extract opaque xref=%s failed: %s", xref, exc, exc_info=True)

        # ── Phase 2b: parallel image compression ─────────────────────
        logger.info("Phase 2b: %d compression tasks (smask_xrefs=%d, digests=%d)",
                    len(tasks), len(smask_xrefs), len(seen_digests))
        replacements: dict[int, fitz.Pixmap] = {}

        if tasks:
            use_pool = len(tasks) >= 4  # overhead not worth it for few images
            logger.debug("Using %s for %d tasks", "thread pool" if use_pool else "sequential", len(tasks))

            if use_pool:
                with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
                    future_to_xref: dict = {}
                    for task in tasks:
                        xref, kind = task[0], task[1]
                        if kind == "opaque":
                            fut = pool.submit(
                                _worker_compress_opaque,
                                task[2], task[3], task[4], task[5], task[6],
                                task[7],
                            )
                        elif kind == "alpha":
                            fut = pool.submit(
                                _worker_downscale_alpha,
                                task[2], task[3], task[4], task[5], task[6],
                            )
                        else:  # smask
                            fut = pool.submit(
                                _worker_combine_smask,
                                task[2], task[3], task[4],
                                task[5], task[6], task[7], task[8],
                                task[9],
                            )
                        future_to_xref[fut] = xref

                    for fut in as_completed(future_to_xref):
                        xref = future_to_xref[fut]
                        try:
                            result_bytes = fut.result()
                            if result_bytes is not None:
                                replacements[xref] = fitz.Pixmap(result_bytes)
                        except Exception as exc:
                            logger.warning("Worker failed xref=%s: %s", xref, exc, exc_info=True)
            else:
                # Sequential fallback for small PDFs
                for task in tasks:
                    xref, kind = task[0], task[1]
                    try:
                        if kind == "opaque":
                            result = _worker_compress_opaque(task[2], task[3], task[4], task[5], task[6], task[7])
                        elif kind == "alpha":
                            result = _worker_downscale_alpha(task[2], task[3], task[4], task[5], task[6])
                        else:
                            result = _worker_combine_smask(task[2], task[3], task[4], task[5], task[6], task[7], task[8], task[9])
                        if result is not None:
                            replacements[xref] = fitz.Pixmap(result)
                    except Exception as exc:
                        logger.warning("Sequential worker failed xref=%s kind=%s: %s", xref, kind, exc, exc_info=True)

        # ── Phase 2c: apply dedup copies ─────────────────────────────
        # (xrefs that shared a digest get the same replacement pixmap)
        digest_to_replacement: dict[str, fitz.Pixmap] = {}
        for digest, canonical_xref in seen_digests.items():
            if canonical_xref in replacements:
                digest_to_replacement[digest] = replacements[canonical_xref]

        for xref in seen_xrefs:
            if xref in smask_xrefs or xref in replacements:
                continue
            digest = _image_stream_digest(doc, xref)
            if digest is not None and digest in digest_to_replacement:
                replacements[xref] = digest_to_replacement[digest]

        # ── Phase 3: apply replacements ──────────────────────────────
        logger.info("Phase 3: applying %d image replacements across %d pages",
                    len(replacements), len(doc))
        for page in doc:
            for img_info in page.get_images(full=True):
                xref = img_info[0]
                if xref in replacements:
                    try:
                        page.replace_image(xref, pixmap=replacements[xref])
                    except Exception as exc:
                        logger.warning("Image replace failed xref=%s: %s", xref, exc)

        replacements.clear()

        # ── Phase 4: save with structure-level compression ───────────
        logger.info("Phase 4: saving with deflate=%s garbage=%d clean=%s",
                    settings["deflate"], settings["garbage"], settings["clean"])
        buf = io.BytesIO()
        doc.save(
            buf,
            deflate=settings["deflate"],
            garbage=settings["garbage"],
            clean=settings["clean"],
            deflate_images=True,
            deflate_fonts=True,
        )
        doc.close()
        buf.seek(0)
        logger.info("Phase 4 done: compressed buffer size=%d", buf.getbuffer().nbytes)

        # ── Phase 5: validate transparency is intact ─────────────────
        validation_warnings = _validate_transparency_preserved(path, buf)
        for w in validation_warnings:
            logger.warning("Compression validation: %s", w)

        compressed_size = buf.getbuffer().nbytes
        logger.info("Phase 5 done: original=%d compressed=%d ratio=%.1f%%",
                    original_size, compressed_size,
                    (1 - compressed_size / original_size) * 100 if original_size > 0 else 0)

        headers = {
            "Content-Disposition": "attachment; filename=compressed.pdf",
            "X-Original-Size": str(original_size),
            "X-Compressed-Size": str(compressed_size),
            "X-Compression-Ratio": (
                f"{(1 - compressed_size / original_size) * 100:.1f}%"
                if original_size > 0
                else "0%"
            ),
            "Access-Control-Expose-Headers": (
                "X-Original-Size, X-Compressed-Size, "
                "X-Compression-Ratio, X-Validation-Warnings"
            ),
        }
        if validation_warnings:
            headers["X-Validation-Warnings"] = "; ".join(validation_warnings)

        return StreamingResponse(buf, media_type="application/pdf", headers=headers)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Compression failed for file=%s level=%s: %s", path, level, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(e)}")
