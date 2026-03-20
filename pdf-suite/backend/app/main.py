import logging
import os
import tempfile
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

TEMP_DIR = os.path.join(tempfile.gettempdir(), "pdf_suite_temp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(TEMP_DIR, exist_ok=True)
    yield
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR, ignore_errors=True)


app = FastAPI(
    title="SmartPDFSuite API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
from app.routers import merge, split, compress, convert, watermark, esign, organize, protect, unlock, redact  # noqa: E402

app.include_router(merge.router, prefix="/api", tags=["Merge"])
app.include_router(split.router, prefix="/api", tags=["Split"])
app.include_router(compress.router, prefix="/api", tags=["Compress"])
app.include_router(convert.router, prefix="/api", tags=["Convert"])
app.include_router(watermark.router, prefix="/api", tags=["Watermark"])
app.include_router(esign.router, prefix="/api", tags=["eSign"])
app.include_router(organize.router, prefix="/api", tags=["Organize"])
app.include_router(protect.router, prefix="/api", tags=["Protect"])
app.include_router(unlock.router, prefix="/api", tags=["Unlock"])
app.include_router(redact.router, prefix="/api", tags=["Redact"])


@app.get("/api/health")
async def health():
    from app.libreoffice import check_libreoffice_installed
    return {
        "status": "ok",
        "libreoffice_available": check_libreoffice_installed(),
    }
