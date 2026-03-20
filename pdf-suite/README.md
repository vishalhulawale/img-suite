# SmartPDFSuite

A lightweight, production-ready, browser-based PDF utility suite. Merge, split, compress, convert, watermark, and eSign PDFs — all without any database dependency.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite + Tailwind)           Port 3000                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │  Merge   │ │  Split   │ │ Compress │ │ Convert  │ │Watermark │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│  ┌──────────┐                                                          │
│  │  eSign   │  ← Drag-drop upload, preview, interactive placement     │
│  └────┬─────┘                                                          │
└───────┼────────────┼────────────┼────────────┼────────────┼────────────┘
        │ REST API   │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Backend (Python + FastAPI)                   Port 8000                │
│                                                                         │
│  Libraries: PyMuPDF · pikepdf · Pillow · python-docx · openpyxl       │
│                                                                         │
│  ● Stateless REST APIs                                                  │
│  ● In-memory / temp file processing                                    │
│  ● Auto-cleanup after response                                         │
│  ● Streaming file responses                                            │
│  ● Strict file validation                                              │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼ (No database)
   ┌──────────┐
   │ /tmp/    │  ← Ephemeral temp storage, auto-deleted
   └──────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| **Merge PDF** | Combine multiple PDFs with drag-and-drop reordering |
| **Split PDF** | Split by ranges, extract pages, or split into individual pages |
| **Compress PDF** | Three compression levels with size comparison |
| **Convert PDF** | PDF → Word (DOCX), Excel (XLSX), Images (PNG/JPG) |
| **Watermark** | Text or image watermarks with position, opacity, rotation |
| **eSign PDF** | Draw, type, or upload signatures with interactive placement |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## CLI Usage

The built-in converter can also be used as a standalone command-line tool:

```bash
cd backend
source venv/Scripts/activate  # or venv\Scripts\activate on Windows

# Convert PDF to DOCX (default)
python -m app.pdf_converter.cli input.pdf

# Convert to a specific format
python -m app.pdf_converter.cli input.pdf -f docx
python -m app.pdf_converter.cli input.pdf -f xlsx
python -m app.pdf_converter.cli input.pdf -f pptx

# Specify output path
python -m app.pdf_converter.cli input.pdf -o output.docx

# Convert specific pages
python -m app.pdf_converter.cli input.pdf --pages 1-5
python -m app.pdf_converter.cli input.pdf --pages 1,3,5

# Choose DOCX layout mode
python -m app.pdf_converter.cli input.pdf --layout-mode flow
python -m app.pdf_converter.cli input.pdf --layout-mode fixed
python -m app.pdf_converter.cli input.pdf --layout-mode auto   # default

# CPU-optimized conversion
python -m app.pdf_converter.cli input.pdf --cpu-enhanced

# Custom image DPI
python -m app.pdf_converter.cli input.pdf --dpi 150

# Debug mode with verbose logging
python -m app.pdf_converter.cli input.pdf --debug --log-level DEBUG
```

### CLI Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `PDF_PATH` | — | *(required)* | Path to the input PDF file |
| `-f, --format` | `docx`, `xlsx`, `pptx` | `docx` | Output format |
| `-o, --output` | path | auto-generated | Output file path |
| `--pages` | e.g. `1-5`, `1,3,5` | all pages | Page range to convert |
| `--layout-mode` | `flow`, `fixed`, `auto` | `auto` | DOCX layout strategy |
| `--cpu-enhanced` | flag | off | Enable CPU-optimized defaults |
| `--cpu-profile` | `balanced` | `balanced` | CPU profile preset |
| `--dpi` | integer | `300` | DPI for image extraction |
| `--debug` | flag | off | Save intermediate results |
| `--log-level` | `DEBUG`, `INFO`, `WARNING`, `ERROR` | `INFO` | Logging verbosity |

## API Reference

### POST /api/merge
Merge multiple PDF files.
- **Body**: `multipart/form-data` with `files` (multiple PDF files)
- **Response**: `application/pdf`

### POST /api/split
Split a PDF file.
- **Body**: `multipart/form-data`
  - `file`: PDF file
  - `mode`: `ranges` | `extract` | `individual`
  - `pages`: Page specification (e.g., `1-5,6-10`)
- **Response**: `application/pdf` or `application/zip`

### POST /api/compress
Compress a PDF file.
- **Body**: `multipart/form-data`
  - `file`: PDF file
  - `level`: `low` | `medium` | `high`
- **Response**: `application/pdf` with compression headers

### POST /api/convert/images
Convert PDF to images.
- **Body**: `multipart/form-data`
  - `file`: PDF file
  - `format`: `png` | `jpg`
  - `dpi`: `72` | `150` | `300`
- **Response**: `image/*` or `application/zip`

### POST /api/convert/docx
Convert PDF to Word document.
- **Body**: `multipart/form-data` with `file`
- **Response**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### POST /api/convert/xlsx
Convert PDF to Excel spreadsheet.
- **Body**: `multipart/form-data` with `file`
- **Response**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### POST /api/watermark
Add watermark to PDF.
- **Body**: `multipart/form-data`
  - `file`: PDF file
  - `watermark_type`: `text` | `image`
  - `text`, `font_size`, `rotation`, `opacity`, `position`, `color`, `pages`
  - `watermark_image`: Image file (for image watermark)
- **Response**: `application/pdf`

### POST /api/esign
Add signatures to PDF.
- **Body**: `multipart/form-data`
  - `file`: PDF file
  - `signatures`: JSON array of signature placements
  - `signature_images`: Image files for image-type signatures
- **Response**: `application/pdf`

### POST /api/esign/preview
Get page images for signature placement.
- **Body**: `multipart/form-data` with `file` and `dpi`
- **Response**: JSON with base64 page images

## Security

- ✅ Strict file type validation (PDF header check + MIME type)
- ✅ Configurable file size limits (default 100MB)
- ✅ No data persistence — files auto-deleted after processing
- ✅ In-memory processing where possible
- ✅ CORS configured for frontend origin
- ✅ No user accounts or sessions

## Libraries & Justification

| Library | Purpose | Why |
|---------|---------|-----|
| **PyMuPDF (fitz)** | PDF manipulation | Fastest Python PDF library, handles merge/split/watermark/images |
| **pikepdf** | PDF internals | Excellent for compression and low-level PDF operations |
| **Pillow** | Image processing | Industry standard for image manipulation |
| **python-docx** | DOCX generation | Clean API for Word document creation |
| **openpyxl** | XLSX generation | Standard Excel file creation library |
| **FastAPI** | Web framework | Async, type-safe, auto-docs, streaming support |
| **React** | Frontend | Component-based, rich ecosystem |
| **TailwindCSS** | Styling | Utility-first, no CSS overhead |
| **react-beautiful-dnd** | Drag & drop | Accessible, smooth reordering |
| **react-dropzone** | File upload | Feature-rich drag-and-drop file input |
