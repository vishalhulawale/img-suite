"""LibreOffice headless conversion helper.

Uses `soffice --headless --convert-to <fmt>` for high-fidelity document
conversion (DOCX/PPTX/XLSX → PDF).  This approach preserves fonts, layout,
tables, images, and styling that pure-Python libraries cannot reproduce.

Trade-offs:
  + Near-native fidelity (90-95% of original layout)
  + Handles complex Office documents reliably
  - Requires LibreOffice installed on the host / container
  - Subprocess invocation adds ~1-3s latency per file
"""

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
import uuid

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Allow override via environment variable (e.g. for containers with non-standard paths)
SOFFICE_BIN = os.environ.get("SOFFICE_BIN", "soffice")

# Maximum seconds to wait for a LibreOffice conversion before killing it
LIBREOFFICE_TIMEOUT = int(os.environ.get("LIBREOFFICE_TIMEOUT", "120"))


def _find_soffice() -> str:
    """Return the path to soffice, checking common locations."""
    if shutil.which(SOFFICE_BIN):
        return SOFFICE_BIN

    # Common installation paths (Linux, macOS, Windows)
    candidates = [
        "/usr/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path

    return SOFFICE_BIN  # fall back — will error when invoked


async def convert_with_libreoffice(
    input_path: str,
    output_format: str = "pdf",
) -> str:
    """Convert a file to *output_format* using LibreOffice headless.

    Parameters
    ----------
    input_path : str
        Absolute path to the source file (e.g. .docx, .pptx, .xlsx).
    output_format : str
        Target format understood by LibreOffice (default ``"pdf"``).

    Returns
    -------
    str
        Absolute path to the converted file inside a *temporary directory*.
        The caller is responsible for cleaning up this directory.

    Raises
    ------
    HTTPException
        On conversion failure, timeout, or if LibreOffice is not installed.
    """
    soffice = _find_soffice()

    # Each invocation gets its own temp dir so parallel calls don't collide.
    # LibreOffice writes output into the --outdir with the same base name.
    work_dir = tempfile.mkdtemp(prefix="lo_convert_")

    try:
        # Use a unique user-installation profile per call to avoid lock
        # conflicts when multiple conversions run simultaneously.
        user_profile = os.path.join(work_dir, f"profile_{uuid.uuid4().hex}")

        cmd = [
            soffice,
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nodefault",
            "--nofirststartwizard",
            f"-env:UserInstallation=file:///{user_profile.replace(os.sep, '/')}",
            "--convert-to", output_format,
            "--outdir", work_dir,
            input_path,
        ]

        logger.info("LibreOffice convert: %s", " ".join(cmd))
        t0 = __import__("time").perf_counter()

        # Run in a thread to avoid blocking the event loop.
        # subprocess.run works reliably on all platforms (unlike
        # asyncio.create_subprocess_exec which fails on Windows).
        loop = asyncio.get_running_loop()

        def _run_soffice():
            # On Windows, CREATE_NO_WINDOW prevents LibreOffice from spawning
            # any window (e.g. file-recovery or update dialogs) that would
            # cause it to hang waiting for user input.
            extra: dict = {}
            if os.name == "nt":
                extra["creationflags"] = subprocess.CREATE_NO_WINDOW
            return subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=LIBREOFFICE_TIMEOUT,
                **extra,
            )

        try:
            proc = await loop.run_in_executor(None, _run_soffice)
        except subprocess.TimeoutExpired:
            shutil.rmtree(work_dir, ignore_errors=True)
            logger.error(
                "LibreOffice timed out after %ds for: %s", LIBREOFFICE_TIMEOUT, input_path
            )
            raise HTTPException(
                status_code=504,
                detail="Document conversion timed out. The file may be too large or complex.",
            )

        elapsed = __import__("time").perf_counter() - t0
        if proc.returncode != 0:
            error_msg = (proc.stderr or proc.stdout or b"").decode(errors="replace").strip()
            logger.error(
                "LibreOffice failed (rc=%s) after %.2fs: %s",
                proc.returncode, elapsed, error_msg,
            )
            shutil.rmtree(work_dir, ignore_errors=True)
            raise HTTPException(
                status_code=500,
                detail=f"LibreOffice conversion failed: {error_msg or 'unknown error'}",
            )

        # Locate the output file
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        expected_output = os.path.join(work_dir, f"{base_name}.{output_format}")

        if not os.path.isfile(expected_output):
            # Sometimes LibreOffice changes casing or adds suffix; scan for it
            for f in os.listdir(work_dir):
                if f.endswith(f".{output_format}") and not f.startswith("profile_"):
                    expected_output = os.path.join(work_dir, f)
                    break
            else:
                shutil.rmtree(work_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=500,
                    detail="Conversion produced no output file. Please try a different file.",
                )

        size_mb = os.path.getsize(expected_output) / 1048576
        logger.info(
            "LibreOffice conversion complete in %.2fs → %s (%.2f MB)",
            elapsed, os.path.basename(expected_output), size_mb,
        )

        # Return path — caller must clean work_dir after reading the file
        return expected_output

    except HTTPException:
        raise
    except Exception as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        logger.exception("Unexpected error in LibreOffice conversion")
        raise HTTPException(
            status_code=500,
            detail=f"Document conversion failed unexpectedly: {exc}",
        )


def check_libreoffice_installed() -> bool:
    """Return True if LibreOffice is reachable on this system."""
    soffice = _find_soffice()
    return shutil.which(soffice) is not None or os.path.isfile(soffice)
