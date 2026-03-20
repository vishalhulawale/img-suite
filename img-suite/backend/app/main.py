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

TEMP_DIR = os.path.join(tempfile.gettempdir(), "img_suite_temp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(TEMP_DIR, exist_ok=True)
    yield
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR, ignore_errors=True)


app = FastAPI(
    title="SmartImageSuite API",
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

from app.routers import (  # noqa: E402
    compress, background, passport, convert, crop_resize,
    enhance, upscale, watermark, text_overlay, profile_pic,
)

app.include_router(compress.router, prefix="/api", tags=["Compress"])
app.include_router(background.router, prefix="/api", tags=["Background Removal"])
app.include_router(passport.router, prefix="/api", tags=["Passport Photo"])
app.include_router(convert.router, prefix="/api", tags=["Format Converter"])
app.include_router(crop_resize.router, prefix="/api", tags=["Crop & Resize"])
app.include_router(enhance.router, prefix="/api", tags=["Auto Enhance"])
app.include_router(upscale.router, prefix="/api", tags=["Image Upscaler"])
app.include_router(watermark.router, prefix="/api", tags=["Watermark Studio"])
app.include_router(text_overlay.router, prefix="/api", tags=["Text on Image"])
app.include_router(profile_pic.router, prefix="/api", tags=["Profile Picture"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
