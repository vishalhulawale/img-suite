# SmartImageSuite

Free online image tools — compress images, remove backgrounds, and create passport photos. Built as a sibling product to SmartPDFSuite.

## Features

- **Image Compress** — Reduce image file size with adjustable compression levels (low/medium/high) or a target size limit. Preview before & after, see compression stats.
- **Background Removal** — Automatically remove backgrounds from photos. Uses `rembg` (ONNX, CPU-only) for local processing. Outputs transparent PNG.
- **Passport Photo Creator** — Multiple size presets (US 2×2, EU 35×45mm, India 33×48mm, Canada 51×51mm), custom background color, face position adjustment. 300 DPI output.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, react-router-dom |
| Backend  | Python, FastAPI, Pillow, rembg (ONNX Runtime) |
| Infra    | Docker, Docker Compose, Nginx |

## Quick Start

### Local Development

**Backend:**

```bash
cd img-suite/backend
python -m venv venv
source venv/Scripts/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd img-suite/frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to `localhost:8000`.

### Docker Compose

```bash
cd img-suite
docker compose up --build
```

The app will be available at `http://localhost:3080`.

> **Note:** The first request to the background removal endpoint may take longer as `rembg` downloads the ONNX model (~176 MB) on first use.

## Project Structure

```
img-suite/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI app entry
│       ├── utils.py             # Shared utilities
│       └── routers/
│           ├── compress.py      # Image compression endpoint
│           ├── background.py    # Background removal endpoint
│           └── passport.py      # Passport photo endpoint
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx              # Router setup
        ├── api.ts               # Centralized API client
        ├── main.tsx             # Entry point
        ├── index.css            # Tailwind + custom styles
        ├── components/
        │   ├── Layout.tsx       # App shell (header, sidebar, footer)
        │   ├── FileDropzone.tsx # Drag-and-drop file upload
        │   ├── ProgressBar.tsx  # Upload/processing progress
        │   ├── ImagePreview.tsx # Image preview with transparency grid
        │   └── SEOHead.tsx      # SEO meta tags
        └── pages/
            ├── Home.tsx
            ├── CompressPage.tsx
            ├── RemoveBackgroundPage.tsx
            └── PassportPhotoPage.tsx
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/compress` | Compress an image |
| POST | `/api/remove-background` | Remove image background |
| GET | `/api/passport/presets` | List passport photo presets |
| POST | `/api/passport` | Create passport photo |

## Design

The UI follows the same design language as SmartPDFSuite:
- Glass-morphism header, collapsible sidebar
- Tailwind CSS with matching color palette and typography
- Consistent file upload UX with drag-and-drop
- Progress bars with upload/processing phases
- Responsive on desktop and mobile
