import { useState, useCallback, useRef, useEffect } from 'react';
import { Download, Crop } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { cropResizeImage, downloadBlob, CropResizeResult } from '../api';
import SEOHead from '../components/SEOHead';

type HandleDir = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const CROP_MODES: { label: string; ratio: number | null; sub?: string }[] = [
  { label: 'Freeform', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '2:3', ratio: 2 / 3 },
  { label: 'Instagram Post', ratio: 1, sub: '1080×1080' },
  { label: 'Instagram Story', ratio: 9 / 16, sub: '1080×1920' },
  { label: 'Facebook Cover', ratio: 820 / 312, sub: '820×312' },
  { label: 'YouTube Thumbnail', ratio: 16 / 9, sub: '1280×720' },
  { label: 'Twitter Header', ratio: 3, sub: '1500×500' },
  { label: 'LinkedIn Banner', ratio: 4, sub: '1584×396' },
];

const HANDLE_CURSORS: Record<string, string> = {
  n: 'cursor-n-resize',
  s: 'cursor-s-resize',
  e: 'cursor-e-resize',
  w: 'cursor-w-resize',
  nw: 'cursor-nw-resize',
  ne: 'cursor-ne-resize',
  sw: 'cursor-sw-resize',
  se: 'cursor-se-resize',
};

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function CropResizePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CropResizeResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 100, h: 100 });
  const [dragging, setDragging] = useState<HandleDir | null>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  const imgRef = useRef<HTMLImageElement>(null);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    setImgDims(null);
    if (newFiles.length > 0) {
      const url = URL.createObjectURL(newFiles[0]);
      setOriginalPreview(url);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        setImgDims({ w, h });
        // Default crop: 80% of image, centered (freeform)
        const cw = Math.round(w * 0.8);
        const ch = Math.round(h * 0.8);
        setCrop({ x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch });
      };
      img.src = url;
    } else {
      setOriginalPreview(null);
    }
  }, []);

  // Reset crop when aspect ratio changes
  useEffect(() => {
    if (!imgDims) return;
    const { w, h } = imgDims;
    if (!aspectRatio) {
      // Freeform: 80% centered
      const cw = Math.round(w * 0.8);
      const ch = Math.round(h * 0.8);
      setCrop({ x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch });
    } else {
      let cw: number, ch: number;
      if (w / h > aspectRatio) {
        ch = Math.round(h * 0.8);
        cw = Math.round(ch * aspectRatio);
      } else {
        cw = Math.round(w * 0.8);
        ch = Math.round(cw / aspectRatio);
      }
      cw = Math.min(cw, w);
      ch = Math.min(ch, h);
      setCrop({ x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch });
    }
  }, [aspectRatio, imgDims]);

  const getDisplayScale = () => {
    if (!imgRef.current || !imgDims) return 1;
    return imgRef.current.clientWidth / imgDims.w;
  };

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, dir: HandleDir) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getMousePos(e);
    setDragging(dir);
    setDragStart({ mx: pos.x, my: pos.y, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h });
  };

  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!dragging || !imgDims || !imgRef.current) return;
      e.preventDefault();
      const rect = imgRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const scale = getDisplayScale();
      const dx = (mx - dragStart.mx) / scale;
      const dy = (my - dragStart.my) / scale;
      const { cx, cy, cw, ch } = dragStart;

      if (dragging === 'move') {
        const nx = Math.max(0, Math.min(imgDims.w - cw, cx + dx));
        const ny = Math.max(0, Math.min(imgDims.h - ch, cy + dy));
        setCrop((prev) => ({ ...prev, x: Math.round(nx), y: Math.round(ny) }));
        return;
      }

      // Determine which edges move
      const movesN = dragging.includes('n');
      const movesS = dragging.includes('s');
      const movesW = dragging.includes('w');
      const movesE = dragging.includes('e');
      // Note: for side handles (n, s, e, w), only one axis moves

      let nx = cx, ny = cy, nw = cw, nh = ch;

      if (movesE) { nw = Math.max(20, cw + dx); }
      if (movesW) { nx = cx + dx; nw = cw - dx; }
      if (movesS) { nh = Math.max(20, ch + dy); }
      if (movesN) { ny = cy + dy; nh = ch - dy; }

      // Enforce minimum size
      if (nw < 20) { if (movesW) { nx = cx + cw - 20; } nw = 20; }
      if (nh < 20) { if (movesN) { ny = cy + ch - 20; } nh = 20; }

      // Enforce aspect ratio
      if (aspectRatio) {
        if (movesE || movesW) {
          nh = nw / aspectRatio;
          if (movesN) { ny = cy + ch - nh; }
        } else {
          nw = nh * aspectRatio;
          if (movesW) { nx = cx + cw - nw; }
        }
      }

      // Clamp to image bounds
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      nw = Math.min(nw, imgDims.w - nx);
      nh = Math.min(nh, imgDims.h - ny);
      if (aspectRatio) {
        const maxW = imgDims.w - nx;
        const maxH = imgDims.h - ny;
        if (nw / nh > aspectRatio) {
          nw = maxH * aspectRatio > maxW ? maxW : maxH * aspectRatio;
          nh = nw / aspectRatio;
        } else {
          nh = maxW / aspectRatio > maxH ? maxH : maxW / aspectRatio;
          nw = nh * aspectRatio;
        }
      }

      setCrop({ x: Math.round(nx), y: Math.round(ny), w: Math.round(Math.max(20, nw)), h: Math.round(Math.max(20, nh)) });
    },
    [dragging, dragStart, imgDims, aspectRatio],
  );

  const handlePointerUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
      return () => {
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerUp);
        window.removeEventListener('touchmove', handlePointerMove);
        window.removeEventListener('touchend', handlePointerUp);
      };
    }
  }, [dragging, handlePointerMove, handlePointerUp]);

  const handleCrop = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await cropResizeImage(
        files[0],
        crop.x, crop.y, crop.w, crop.h,
        0, 0, // no resize — output matches crop
        (pct, phase) => {
          setProgress(pct);
          setStatus(phase === 'processing' ? 'processing' : 'uploading');
        },
      );
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Crop failed');
    }
  };

  const scale = getDisplayScale();
  const cropDisplay = {
    left: crop.x * scale,
    top: crop.y * scale,
    width: crop.w * scale,
    height: crop.h * scale,
  };

  // Handle size
  const hs = 10;
  const hs2 = hs / 2;

  const handles: { dir: HandleDir; style: React.CSSProperties }[] = [
    // Corners
    { dir: 'nw', style: { left: -hs2, top: -hs2, width: hs, height: hs } },
    { dir: 'ne', style: { right: -hs2, top: -hs2, width: hs, height: hs } },
    { dir: 'sw', style: { left: -hs2, bottom: -hs2, width: hs, height: hs } },
    { dir: 'se', style: { right: -hs2, bottom: -hs2, width: hs, height: hs } },
    // Edges
    { dir: 'n', style: { left: '50%', top: -hs2, width: hs * 2, height: hs, marginLeft: -hs } },
    { dir: 's', style: { left: '50%', bottom: -hs2, width: hs * 2, height: hs, marginLeft: -hs } },
    { dir: 'w', style: { left: -hs2, top: '50%', width: hs, height: hs * 2, marginTop: -hs } },
    { dir: 'e', style: { right: -hs2, top: '50%', width: hs, height: hs * 2, marginTop: -hs } },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Crop & Resize — Free Online Image Cropper and Resizer"
        description="Crop and resize images with presets for social media, banners, thumbnails, and stories. Free, no sign-up."
        path="/crop-resize"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Crop & Resize</h1>
        <p className="mt-2 text-gray-600">
          Crop to any aspect ratio or preset. Output size matches your crop selection.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop an image to crop"
        description="Upload an image to crop and resize (PNG, JPG, WebP, AVIF)"
      />

      {files.length > 0 && imgDims && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Unified Crop Mode / Preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Crop Mode</label>
            <div className="flex flex-wrap gap-2">
              {CROP_MODES.map((m) => (
                <button
                  key={m.label}
                  onClick={() => setAspectRatio(m.ratio)}
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    aspectRatio === m.ratio
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                  {m.sub && <span className="ml-1 text-xs text-gray-400">{m.sub}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Visual crop editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Crop Area — drag to move, use handles to resize
            </label>
            <div
              className="relative inline-block rounded-xl overflow-hidden border border-gray-200 select-none"
              style={{ maxWidth: '100%', touchAction: 'none' }}
            >
              <img
                ref={imgRef}
                src={originalPreview!}
                alt="Crop preview"
                className="block max-w-full"
                style={{ maxHeight: '500px' }}
                draggable={false}
              />
              {/* Darkened overlay */}
              <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: '100%', height: cropDisplay.top, background: 'rgba(0,0,0,0.5)' }} />
              <div className="absolute pointer-events-none" style={{ left: 0, top: cropDisplay.top + cropDisplay.height, width: '100%', height: `calc(100% - ${cropDisplay.top + cropDisplay.height}px)`, background: 'rgba(0,0,0,0.5)' }} />
              <div className="absolute pointer-events-none" style={{ left: 0, top: cropDisplay.top, width: cropDisplay.left, height: cropDisplay.height, background: 'rgba(0,0,0,0.5)' }} />
              <div className="absolute pointer-events-none" style={{ left: cropDisplay.left + cropDisplay.width, top: cropDisplay.top, width: `calc(100% - ${cropDisplay.left + cropDisplay.width}px)`, height: cropDisplay.height, background: 'rgba(0,0,0,0.5)' }} />
              {/* Crop box */}
              <div
                className="absolute border-2 border-white cursor-move"
                style={{
                  left: cropDisplay.left,
                  top: cropDisplay.top,
                  width: cropDisplay.width,
                  height: cropDisplay.height,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                }}
                onMouseDown={(e) => handlePointerDown(e, 'move')}
                onTouchStart={(e) => handlePointerDown(e, 'move')}
              >
                {/* Grid lines (thirds) */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                </div>
                {/* Resize handles on all corners and edges */}
                {handles.map((h) => (
                  <div
                    key={h.dir}
                    className={`absolute bg-white border-2 border-orange-500 rounded-sm shadow-md ${HANDLE_CURSORS[h.dir]}`}
                    style={{ ...h.style, position: 'absolute', zIndex: 10 }}
                    onMouseDown={(e) => handlePointerDown(e, h.dir)}
                    onTouchStart={(e) => handlePointerDown(e, h.dir)}
                  />
                ))}
                {/* Size indicator */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white whitespace-nowrap pointer-events-none">
                  {crop.w} × {crop.h}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Output: {crop.w} × {crop.h} px
            </p>
          </div>

          {/* Progress */}
          <ProgressBar progress={progress} status={status} message={error} processingMessage="Cropping…" />

          {/* Result preview */}
          {result && status === 'done' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImagePreview
                  src={originalPreview!}
                  alt="Original"
                  label={`Original (${imgDims.w}×${imgDims.h})`}
                />
                <ImagePreview
                  src={result.previewUrl}
                  alt="Cropped"
                  label={`Result (${result.outputWidth}×${result.outputHeight})`}
                />
              </div>
              <div className="p-5 bg-orange-50 border border-orange-200 rounded-xl animate-fade-in">
                <div className="flex items-center gap-3">
                  <Crop className="w-5 h-5 text-orange-600" />
                  <span className="font-semibold text-orange-800">
                    Cropped to {result.outputWidth} × {result.outputHeight}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCrop}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-orange-500/25"
            >
              <Crop className="w-5 h-5" />
              Crop
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-orange-700 font-semibold rounded-xl border-2 border-orange-200 hover:bg-orange-50 transition-colors"
              >
                <Download className="w-5 h-5 inline mr-1" />
                Download
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
