import { useState, useCallback, useEffect, useRef } from 'react';
import { Download, User } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { createProfilePicture, downloadBlob, getProfilePicPresets, ProfilePicPreset, ProfilePicResult } from '../api';
import SEOHead from '../components/SEOHead';

const PLATFORM_COLORS: Record<string, string> = {
  whatsapp: 'bg-green-50 border-green-500 text-green-700',
  instagram: 'bg-pink-50 border-pink-500 text-pink-700',
  linkedin: 'bg-blue-50 border-blue-500 text-blue-700',
  facebook: 'bg-blue-50 border-blue-500 text-blue-700',
  x: 'bg-gray-50 border-gray-500 text-gray-700',
  youtube: 'bg-red-50 border-red-500 text-red-700',
  discord: 'bg-indigo-50 border-indigo-500 text-indigo-700',
  custom: 'bg-violet-50 border-violet-500 text-violet-700',
};

const DEFAULT_PRESETS: Record<string, ProfilePicPreset> = {
  whatsapp: { size: 640, label: 'WhatsApp (640×640)' },
  instagram: { size: 1080, label: 'Instagram (1080×1080)' },
  linkedin: { size: 400, label: 'LinkedIn (400×400)' },
  facebook: { size: 320, label: 'Facebook (320×320)' },
  x: { size: 400, label: 'X / Twitter (400×400)' },
  youtube: { size: 800, label: 'YouTube (800×800)' },
  discord: { size: 512, label: 'Discord (512×512)' },
  custom: { size: 500, label: 'Custom (500×500)' },
};

export default function ProfilePicturePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [presets, setPresets] = useState<Record<string, ProfilePicPreset>>(DEFAULT_PRESETS);
  const [platform, setPlatform] = useState('instagram');
  const [customSize, setCustomSize] = useState(500);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProfilePicResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, ox: 0, oy: 0 });
  const previewImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    getProfilePicPresets()
      .then(setPresets)
      .catch(() => setPresets(DEFAULT_PRESETS));
  }, []);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    setOffsetX(0);
    setOffsetY(0);
    setZoom(1.0);
    if (newFiles.length > 0) {
      const url = URL.createObjectURL(newFiles[0]);
      setOriginalPreview(url);
      const img = new Image();
      img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    } else {
      setOriginalPreview(null);
      setImgDims(null);
    }
  }, []);

  const handleCreate = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await createProfilePicture(
        files[0],
        platform,
        customSize,
        offsetX,
        offsetY,
        zoom,
        'color',
        '#FFFFFF',
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
      setError(err?.response?.data?.detail || err.message || 'Profile picture creation failed');
    }
  };

  const selectedPreset = presets[platform];
  const outputSize = platform === 'custom' ? customSize : selectedPreset?.size || 500;

  // Compute max drag range
  const getMaxOffset = useCallback(() => {
    if (!imgDims) return 1;
    const minDim = Math.min(imgDims.w, imgDims.h);
    const surplus = Math.max(imgDims.w, imgDims.h) - minDim / zoom;
    return Math.max(0.5, (surplus / minDim) * 0.5 + 0.5);
  }, [imgDims, zoom]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragging(true);
    setDragStart({ mx: clientX, my: clientY, ox: offsetX, oy: offsetY });
  };

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!dragging || !previewImgRef.current || !imgDims) return;
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const containerW = previewImgRef.current.clientWidth;
      const dx = (clientX - dragStart.mx) / containerW * 2;
      const dy = (clientY - dragStart.my) / containerW * 2;
      const maxOff = getMaxOffset();
      setOffsetX(Math.max(-maxOff, Math.min(maxOff, dragStart.ox + dx)));
      setOffsetY(Math.max(-maxOff, Math.min(maxOff, dragStart.oy + dy)));
    },
    [dragging, dragStart, imgDims, getMaxOffset],
  );

  const handleDragEnd = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.round(Math.max(1.0, Math.min(3.0, z + (e.deltaY < 0 ? 0.1 : -0.1))) * 10) / 10);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [dragging, handleDragMove, handleDragEnd]);

  // Compute square crop overlay on the preview image
  const getOverlayStyle = useCallback(() => {
    if (!previewImgRef.current || !imgDims) return null;
    const scale = previewImgRef.current.clientWidth / imgDims.w;
    const minDim = Math.min(imgDims.w, imgDims.h);
    let side = minDim / zoom;
    side = Math.min(side, minDim);

    let frameX = (imgDims.w - side) / 2 + offsetX * minDim * 0.5;
    let frameY = (imgDims.h - side) / 2 + offsetY * minDim * 0.5;
    frameX = Math.max(0, Math.min(frameX, imgDims.w - side));
    frameY = Math.max(0, Math.min(frameY, imgDims.h - side));

    return {
      left: frameX * scale,
      top: frameY * scale,
      width: side * scale,
      height: side * scale,
    };
  }, [imgDims, offsetX, offsetY, zoom]);

  const [overlayStyle, setOverlayStyle] = useState<ReturnType<typeof getOverlayStyle>>(null);

  useEffect(() => {
    const update = () => setOverlayStyle(getOverlayStyle());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [getOverlayStyle]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <SEOHead
        title="Profile Picture Maker — Create Perfect Profile Photos"
        description="Create profile pictures sized perfectly for WhatsApp, Instagram, LinkedIn, Facebook, X, YouTube, and Discord. Free online tool."
        path="/profile-picture"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Picture Maker</h1>
        <p className="mt-2 text-gray-600">
          Create perfectly sized profile photos for any social platform.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop your photo here"
        description="Upload a photo for your profile picture (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: Settings */}
            <div className="space-y-6">
              {/* Platform selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Choose Platform</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
                  {Object.entries(presets).map(([key, preset]) => {
                    const isActive = platform === key;
                    const colorClass = isActive
                      ? PLATFORM_COLORS[key] || 'bg-violet-50 border-violet-500 text-violet-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300';
                    return (
                      <button
                        key={key}
                        onClick={() => setPlatform(key)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${colorClass}`}
                      >
                        <p className="font-semibold text-sm">{preset.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom size */}
              {platform === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Size (px)</label>
                  <input
                    type="number"
                    min="64"
                    max="2048"
                    value={customSize}
                    onChange={(e) => setCustomSize(Math.max(64, Math.min(2048, parseInt(e.target.value) || 64)))}
                    className="w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">Output: {customSize}×{customSize} px</p>
                </div>
              )}

              {/* Progress & results */}
              <ProgressBar progress={progress} status={status} message={error} processingMessage="Creating profile picture…" />

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={!files[0] || status === 'uploading' || status === 'processing'}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-500/25"
                >
                  <User className="w-5 h-5" />
                  Create Profile Picture
                </button>
                {result && (
                  <button
                    onClick={() => downloadBlob(result.blob, result.filename)}
                    className="px-6 py-3.5 bg-white text-violet-700 font-semibold rounded-xl border-2 border-violet-200 hover:bg-violet-50 transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-1" />
                    Download
                  </button>
                )}
              </div>

              {result && status === 'done' && (
                <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-violet-600" />
                    <span className="font-semibold text-violet-800">Profile picture ready!</span>
                  </div>
                  <p className="text-sm text-violet-600 mt-1">{outputSize}×{outputSize} px — optimized for {presets[platform]?.label || platform}.</p>
                </div>
              )}
            </div>

            {/* RIGHT: Interactive preview */}
            <div className="space-y-4">
              {originalPreview && imgDims && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Drag to position — scroll to zoom
                  </label>
                  <div className="flex gap-4 items-start">
                    {/* Main image with overlay */}
                    <div
                      className="relative flex-1 inline-block rounded-xl overflow-hidden border border-gray-200 select-none"
                      style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                      onWheel={handleWheel}
                    >
                      <img
                        ref={previewImgRef}
                        src={originalPreview}
                        alt="Profile preview"
                        className="block w-full"
                        style={{ maxHeight: '500px', objectFit: 'contain' }}
                        draggable={false}
                        onLoad={() => setOverlayStyle(getOverlayStyle())}
                      />
                      {overlayStyle && (
                        <>
                          <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: '100%', height: overlayStyle.top, background: 'rgba(0,0,0,0.45)' }} />
                          <div className="absolute pointer-events-none" style={{ left: 0, top: overlayStyle.top + overlayStyle.height, width: '100%', height: `calc(100% - ${overlayStyle.top + overlayStyle.height}px)`, background: 'rgba(0,0,0,0.45)' }} />
                          <div className="absolute pointer-events-none" style={{ left: 0, top: overlayStyle.top, width: overlayStyle.left, height: overlayStyle.height, background: 'rgba(0,0,0,0.45)' }} />
                          <div className="absolute pointer-events-none" style={{ left: overlayStyle.left + overlayStyle.width, top: overlayStyle.top, width: `calc(100% - ${overlayStyle.left + overlayStyle.width}px)`, height: overlayStyle.height, background: 'rgba(0,0,0,0.45)' }} />
                          <div
                            className="absolute pointer-events-none border-2 border-dashed border-violet-400"
                            style={{
                              left: overlayStyle.left,
                              top: overlayStyle.top,
                              width: overlayStyle.width,
                              height: overlayStyle.height,
                              borderRadius: '50%',
                              boxShadow: '0 0 0 2px rgba(0,0,0,0.2)',
                            }}
                          />
                          <div
                            className="absolute pointer-events-none border border-white/30"
                            style={{
                              left: overlayStyle.left,
                              top: overlayStyle.top,
                              width: overlayStyle.width,
                              height: overlayStyle.height,
                            }}
                          >
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white whitespace-nowrap">
                              {outputSize}×{outputSize}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Small circular preview */}
                    <div className="flex-shrink-0">
                      <div
                        className="w-24 h-24 rounded-full overflow-hidden border-2 border-violet-300 shadow-md"
                        style={{ background: '#fff' }}
                      >
                        <img
                          src={originalPreview}
                          alt="Circle preview"
                          className="w-full h-full object-cover"
                          style={{
                            transform: `scale(${zoom}) translate(${offsetX * 20}%, ${offsetY * 20}%)`,
                            transition: 'transform 0.15s ease-out',
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 text-center mt-1">Preview</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Drag to reposition. Scroll to zoom in/out. Zoom: {zoom.toFixed(1)}×</p>
                </div>
              )}

              {/* Result */}
              {result && status === 'done' && (
                <ImagePreview src={result.previewUrl} alt="Profile Picture" label={presets[platform]?.label || platform} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
