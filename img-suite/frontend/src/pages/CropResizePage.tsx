import { useState, useCallback, useRef, useEffect } from 'react';
import { Download, Crop, Move } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { cropResizeImage, downloadBlob, CropResizeResult } from '../api';
import SEOHead from '../components/SEOHead';

const ASPECT_RATIOS = [
  { label: 'Freeform', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 },
];

const PRESETS = [
  { label: 'Instagram Post', w: 1080, h: 1080, ratio: 1 },
  { label: 'Instagram Story', w: 1080, h: 1920, ratio: 9 / 16 },
  { label: 'Facebook Cover', w: 820, h: 312, ratio: 820 / 312 },
  { label: 'YouTube Thumbnail', w: 1280, h: 720, ratio: 16 / 9 },
  { label: 'Twitter Header', w: 1500, h: 500, ratio: 3 },
  { label: 'LinkedIn Banner', w: 1584, h: 396, ratio: 4 },
];

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function CropResizePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [resizeW, setResizeW] = useState('');
  const [resizeH, setResizeH] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CropResizeResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 100, h: 100 });
  const [dragging, setDragging] = useState<'move' | 'resize' | null>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    setImgDims(null);
    setResizeW('');
    setResizeH('');
    if (newFiles.length > 0) {
      const url = URL.createObjectURL(newFiles[0]);
      setOriginalPreview(url);
      const img = new Image();
      img.onload = () => {
        setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
        setCrop({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
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
      setCrop({ x: 0, y: 0, w, h });
    } else {
      let cw: number, ch: number;
      if (w / h > aspectRatio) {
        ch = h;
        cw = Math.round(h * aspectRatio);
      } else {
        cw = w;
        ch = Math.round(w / aspectRatio);
      }
      setCrop({ x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch });
    }
  }, [aspectRatio, imgDims]);

  const selectPreset = (preset: typeof PRESETS[number]) => {
    setAspectRatio(preset.ratio);
    setResizeW(String(preset.w));
    setResizeH(String(preset.h));
  };

  // Display-space helpers
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

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, type: 'move' | 'resize') => {
    e.preventDefault();
    const pos = getMousePos(e);
    setDragging(type);
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

      if (dragging === 'move') {
        const nx = Math.max(0, Math.min(imgDims.w - dragStart.cw, dragStart.cx + dx));
        const ny = Math.max(0, Math.min(imgDims.h - dragStart.ch, dragStart.cy + dy));
        setCrop((prev) => ({ ...prev, x: Math.round(nx), y: Math.round(ny) }));
      } else if (dragging === 'resize') {
        let nw = Math.max(20, dragStart.cw + dx);
        let nh = Math.max(20, dragStart.ch + dy);
        if (aspectRatio) {
          nh = nw / aspectRatio;
        }
        nw = Math.min(nw, imgDims.w - crop.x);
        nh = Math.min(nh, imgDims.h - crop.y);
        if (aspectRatio) {
          const constrainedByW = imgDims.w - crop.x;
          const constrainedByH = imgDims.h - crop.y;
          const maxByW = constrainedByW;
          const maxByH = constrainedByH * aspectRatio;
          nw = Math.min(nw, maxByW, maxByH);
          nh = nw / aspectRatio;
        }
        setCrop((prev) => ({ ...prev, w: Math.round(Math.max(20, nw)), h: Math.round(Math.max(20, nh)) }));
      }
    },
    [dragging, dragStart, imgDims, aspectRatio, crop.x, crop.y],
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
      const rW = resizeW ? parseInt(resizeW) : 0;
      const rH = resizeH ? parseInt(resizeH) : 0;
      const res = await cropResizeImage(
        files[0],
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        rW,
        rH,
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
      setError(err?.response?.data?.detail || err.message || 'Crop/resize failed');
    }
  };

  const scale = getDisplayScale();
  const cropDisplay = {
    left: crop.x * scale,
    top: crop.y * scale,
    width: crop.w * scale,
    height: crop.h * scale,
  };

  const outputW = resizeW ? parseInt(resizeW) : crop.w;
  const outputH = resizeH ? parseInt(resizeH) : crop.h;

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
          Crop to any aspect ratio and resize for social media, thumbnails, banners, and more.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop an image to crop"
        description="Upload an image to crop and resize (PNG, JPG, WebP)"
      />

      {files.length > 0 && imgDims && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => selectPreset(p)}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-orange-400 hover:text-orange-700 transition-all"
                >
                  {p.label}
                  <span className="ml-1 text-xs text-gray-400">{p.w}×{p.h}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Aspect Ratio</label>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.label}
                  onClick={() => setAspectRatio(ar.value)}
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    aspectRatio === ar.value
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visual crop editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Crop Area — drag to move, drag corner to resize
            </label>
            <div
              ref={imgContainerRef}
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
              {/* Darkened overlay outside crop */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to right, 
                    rgba(0,0,0,0.5) ${cropDisplay.left}px, 
                    transparent ${cropDisplay.left}px, 
                    transparent ${cropDisplay.left + cropDisplay.width}px, 
                    rgba(0,0,0,0.5) ${cropDisplay.left + cropDisplay.width}px)`,
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: `${cropDisplay.top}px`,
                  background: 'rgba(0,0,0,0.5)',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  bottom: 0,
                  width: '100%',
                  height: `calc(100% - ${cropDisplay.top + cropDisplay.height}px)`,
                  background: 'rgba(0,0,0,0.5)',
                }}
              />
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
                {/* Resize handle (bottom-right) */}
                <div
                  className="absolute -right-2 -bottom-2 w-5 h-5 bg-white border-2 border-orange-500 rounded-full cursor-se-resize shadow-md"
                  onMouseDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'resize'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handlePointerDown(e, 'resize'); }}
                />
                {/* Size indicator */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white whitespace-nowrap pointer-events-none">
                  {crop.w} × {crop.h}
                </div>
              </div>
            </div>
          </div>

          {/* Output size controls */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Output Size (optional resize after crop)</label>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Width</label>
                <input
                  type="number"
                  min="1"
                  max="8000"
                  placeholder={String(crop.w)}
                  value={resizeW}
                  onChange={(e) => setResizeW(e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
              </div>
              <span className="text-gray-400 mt-5">×</span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Height</label>
                <input
                  type="number"
                  min="1"
                  max="8000"
                  placeholder={String(crop.h)}
                  value={resizeH}
                  onChange={(e) => setResizeH(e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
              </div>
              <span className="text-sm text-gray-500 mt-5">px</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Final output: {outputW || crop.w} × {outputH || crop.h} px
            </p>
          </div>

          {/* Progress */}
          <ProgressBar progress={progress} status={status} message={error} processingMessage="Cropping & resizing…" />

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
              Crop & Resize
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
