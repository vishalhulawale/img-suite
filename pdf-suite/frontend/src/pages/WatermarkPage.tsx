import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import { addWatermark, getWatermarkPreview, downloadBlob, checkPdfEncrypted } from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

const POSITIONS = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

const POSITION_COORDS: Record<string, { x: number; y: number }> = {
  center: { x: 0.5, y: 0.5 },
  'top-left': { x: 0.15, y: 0.15 },
  'top-right': { x: 0.85, y: 0.15 },
  'bottom-left': { x: 0.15, y: 0.85 },
  'bottom-right': { x: 0.85, y: 0.85 },
};

/* ─── Overlay canvas that draws the watermark on top of the real PDF preview ─── */
function WatermarkOverlay({
  width,
  height,
  watermarkType,
  text,
  fontSize,
  rotation,
  opacity,
  position,
  color,
  watermarkImageFile,
  imageScale,
}: {
  width: number;
  height: number;
  watermarkType: 'text' | 'image';
  text: string;
  fontSize: number;
  rotation: number;
  opacity: number;
  position: string;
  color: string;
  watermarkImageFile: File | null;
  imageScale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (watermarkType === 'image' && watermarkImageFile) {
      const reader = new FileReader();
      reader.onload = () => setImgDataUrl(reader.result as string);
      reader.readAsDataURL(watermarkImageFile);
    } else {
      setImgDataUrl(null);
    }
  }, [watermarkType, watermarkImageFile]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const pos = POSITION_COORDS[position] || POSITION_COORDS.center;
    const cx = width * pos.x;
    const cy = height * pos.y;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (watermarkType === 'text' && text) {
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      const scaledFontSize = Math.max(8, (fontSize / 48) * 28);
      ctx.font = `bold ${scaledFontSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
    } else if (watermarkType === 'image' && imgDataUrl) {
      const img = new Image();
      img.src = imgDataUrl;
      const imgW = width * imageScale;
      const imgH = height * imageScale;
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
    }

    ctx.restore();
  }, [watermarkType, text, fontSize, rotation, opacity, position, color, imgDataUrl, imageScale, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!imgDataUrl) return;
    const img = new Image();
    img.onload = () => draw();
    img.src = imgDataUrl;
  }, [imgDataUrl, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none"
    />
  );
}

export default function WatermarkPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(48);
  const [rotation, setRotation] = useState(-45);
  const [opacity, setOpacity] = useState(0.3);
  const [position, setPosition] = useState<string>('diagonal');
  const [color, setColor] = useState('#888888');
  const [pages, setPages] = useState('all');
  const [watermarkImage, setWatermarkImage] = useState<File[]>([]);
  const [imageScale, setImageScale] = useState(0.3);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  // PDF preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number }>({ w: 300, h: 400 });
  const [totalPages, setTotalPages] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);

  // Load actual PDF preview when a file is selected
  useEffect(() => {
    if (!files[0]) {
      setPreviewImage(null);
      setTotalPages(0);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    getWatermarkPreview(files[0])
      .then((data) => {
        if (cancelled) return;
        setPreviewImage(data.image);
        setPreviewDims({ w: data.width, h: data.height });
        setTotalPages(data.totalPages);
      })
      .catch(() => {
        if (!cancelled) setPreviewImage(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => { cancelled = true; };
  }, [files]);

  const handleFilesChange = useCallback(async (newFiles: File[]) => {
    setFiles(newFiles);
    setIsEncrypted(false);
    if (status === 'done' || status === 'error') {
      setStatus('idle');
      setProgress(0);
      setError('');
    }
    if (newFiles.length > 0) {
      try {
        const encrypted = await checkPdfEncrypted(newFiles[0]);
        setIsEncrypted(encrypted);
      } catch { /* ignore check failure */ }
    }
  }, [status]);

  const handleWatermarkImageChange = useCallback((newFiles: File[]) => {
    setWatermarkImage(newFiles);
    if (status === 'done' || status === 'error') {
      setStatus('idle');
      setProgress(0);
      setError('');
    }
  }, [status]);

  const resetDoneStatus = useCallback(() => {
    if (status === 'done' || status === 'error') {
      setStatus('idle');
      setProgress(0);
      setError('');
    }
  }, [status]);

  const handleWatermark = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      const result = await addWatermark(
        files[0],
        {
          watermarkType,
          text: watermarkType === 'text' ? text : undefined,
          fontSize,
          rotation,
          opacity,
          position,
          color,
          pages,
          watermarkImage: watermarkType === 'image' ? watermarkImage[0] : undefined,
          imageScale,
        },
        (pct) => {
          setProgress(pct);
          if (pct >= 100) setStatus('processing');
        },
      );
      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Watermark failed');
    }
  };

  /* ─── Compute display dimensions for the preview (max 380px tall) ─── */
  const maxH = 380;
  const scale = previewDims.h > maxH ? maxH / previewDims.h : 1;
  const displayW = Math.round(previewDims.w * scale);
  const displayH = Math.round(previewDims.h * scale);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Add Watermark to PDF — Text & Image Watermarks Free"
        description="Add watermarks to PDF for free — text or image watermarks with custom position, opacity, and rotation. No sign-up, no install."
        path="/watermark"
      />
      <JsonLd data={toolSchema('Watermark PDF — Free Online Tool', 'Add text or image watermarks to PDF documents for free online.', 'https://smartpdfsuite.com/watermark')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Add Watermark</h1>
        <p className="mt-2 text-gray-600">
          Add text or image watermarks to your PDF documents.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop a PDF file here"
        description="Upload a PDF to watermark"
      />

      {files.length > 0 && isEncrypted && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">This PDF is password-protected</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please remove the password protection first using the{' '}
              <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before adding a watermark.
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && !isEncrypted && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fade-in">
          {/* ─── Left: Configuration Panel ─── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Watermark type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Watermark Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setWatermarkType('text'); resetDoneStatus(); }}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    watermarkType === 'text' ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`font-semibold text-sm ${watermarkType === 'text' ? 'text-cyan-700' : 'text-gray-700'}`}>
                    Text Watermark
                  </p>
                </button>
                <button
                  onClick={() => { setWatermarkType('image'); resetDoneStatus(); }}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    watermarkType === 'image' ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`font-semibold text-sm ${watermarkType === 'image' ? 'text-cyan-700' : 'text-gray-700'}`}>
                    Image Watermark
                  </p>
                </button>
              </div>
            </div>

            {/* Text options */}
            {watermarkType === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Watermark Text</label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => { setText(e.target.value); resetDoneStatus(); }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => { setFontSize(parseInt(e.target.value) || 48); resetDoneStatus(); }}
                      min={12}
                      max={200}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rotation</label>
                    <input
                      type="number"
                      value={rotation}
                      onChange={(e) => { setRotation(parseInt(e.target.value) || 0); resetDoneStatus(); }}
                      min={-180}
                      max={180}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Opacity</label>
                    <input
                      type="range"
                      value={opacity}
                      onChange={(e) => { setOpacity(parseFloat(e.target.value)); resetDoneStatus(); }}
                      min={0.05}
                      max={1}
                      step={0.05}
                      className="w-full mt-3"
                    />
                    <span className="text-xs text-gray-500">{Math.round(opacity * 100)}%</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => { setColor(e.target.value); resetDoneStatus(); }}
                      className="w-full h-12 rounded-xl border border-gray-300 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Image watermark options */}
            {watermarkType === 'image' && (
              <div className="space-y-4">
                <FileDropzone
                  files={watermarkImage}
                  onFilesChange={handleWatermarkImageChange}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
                  multiple={false}
                  label="Drop watermark image here"
                  description="PNG, JPG, or WebP"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image Size</label>
                  <input
                    type="range"
                    value={imageScale}
                    onChange={(e) => { setImageScale(parseFloat(e.target.value)); resetDoneStatus(); }}
                    min={0.05}
                    max={1}
                    step={0.05}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">{Math.round(imageScale * 100)}% of page</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rotation</label>
                    <input
                      type="number"
                      value={rotation}
                      onChange={(e) => { setRotation(parseInt(e.target.value) || 0); resetDoneStatus(); }}
                      min={-180}
                      max={180}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Opacity</label>
                    <input
                      type="range"
                      value={opacity}
                      onChange={(e) => { setOpacity(parseFloat(e.target.value)); resetDoneStatus(); }}
                      min={0.05}
                      max={1}
                      step={0.05}
                      className="w-full mt-3"
                    />
                    <span className="text-xs text-gray-500">{Math.round(opacity * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Position</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => { setPosition(pos); resetDoneStatus(); }}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      position === pos
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Pages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Apply to Pages</label>
              <input
                type="text"
                value={pages}
                onChange={(e) => { setPages(e.target.value); resetDoneStatus(); }}
                placeholder="all, or 1,3,5-10"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* ─── Right: Live Preview Panel ─── */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Live Preview</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner bg-gray-50 flex flex-col items-center justify-center p-4 min-h-[300px]">
                {loadingPreview ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">Loading preview…</span>
                  </div>
                ) : previewImage ? (
                  <>
                    <div className="relative" style={{ width: displayW, height: displayH }}>
                      <img
                        src={`data:image/png;base64,${previewImage}`}
                        alt="PDF page preview"
                        className="rounded-lg shadow-md w-full h-full object-contain"
                        draggable={false}
                      />
                      <WatermarkOverlay
                        width={displayW}
                        height={displayH}
                        watermarkType={watermarkType}
                        text={text}
                        fontSize={fontSize}
                        rotation={rotation}
                        opacity={opacity}
                        position={position}
                        color={color}
                        watermarkImageFile={watermarkImage[0] || null}
                        imageScale={imageScale}
                      />
                    </div>
                    {totalPages > 0 && (
                      <p className="text-xs text-gray-400 mt-2">Page 1 of {totalPages}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Upload a PDF to see preview</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && !isEncrypted && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Watermarking PDF — this may take a moment…" />
          </div>

          <div className="mt-8">
            <button
              onClick={handleWatermark}
              disabled={
                !files[0] ||
                (watermarkType === 'text' && !text) ||
                (watermarkType === 'image' && !watermarkImage[0]) ||
                status === 'uploading' ||
                status === 'processing'
              }
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-cyan-600 text-white font-semibold rounded-xl hover:bg-cyan-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-cyan-500/25"
            >
              <Download className="w-5 h-5" />
              Add Watermark & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
