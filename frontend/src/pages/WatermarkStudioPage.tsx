import { useState, useCallback, useRef, useEffect } from 'react';
import { Download, Droplets, Type, ImageIcon } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { applyWatermark, downloadBlob, WatermarkResult } from '../api';
import SEOHead from '../components/SEOHead';

type WatermarkMode = 'text' | 'image';

const POSITIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'center', label: 'Center' },
  { value: 'repeated', label: 'Repeated Pattern' },
  { value: 'strip', label: 'Full-Width Strip' },
];

function _getPositionStyle(position: string, padding: number, scale: number): React.CSSProperties {
  const pad = `${Math.max(4, padding * scale)}px`;
  switch (position) {
    case 'top-left': return { top: pad, left: pad };
    case 'top-right': return { top: pad, right: pad };
    case 'bottom-left': return { bottom: pad, left: pad };
    case 'bottom-right': return { bottom: pad, right: pad };
    case 'center': return { top: '50%', left: '50%', transform: `translate(-50%, -50%)${position === 'center' ? '' : ''}` };
    default: return { bottom: pad, right: pad };
  }
}

export default function WatermarkStudioPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<WatermarkMode>('text');
  const [text, setText] = useState('© My Brand');
  const [wmFiles, setWmFiles] = useState<File[]>([]);
  const [position, setPosition] = useState('bottom-right');
  const [opacity, setOpacity] = useState(50);
  const [fontSize, setFontSize] = useState(32);
  const [color, setColor] = useState('#FFFFFF');
  const [rotation, setRotation] = useState(0);
  const [padding, setPadding] = useState(20);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<WatermarkResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [wmImagePreview, setWmImagePreview] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
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

  // Track watermark image preview
  useEffect(() => {
    if (wmFiles.length > 0) {
      const url = URL.createObjectURL(wmFiles[0]);
      setWmImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setWmImagePreview(null);
    }
  }, [wmFiles]);

  // Compute preview scale ratio (displayed width / actual image width)
  useEffect(() => {
    const update = () => {
      if (previewImgRef.current && imgDims) {
        setPreviewScale(previewImgRef.current.clientWidth / imgDims.w);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [imgDims, originalPreview]);

  const handleApply = async () => {
    if (!files[0]) return;
    if (mode === 'text' && !text.trim()) return;
    if (mode === 'image' && !wmFiles[0]) return;

    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await applyWatermark(
        files[0],
        {
          text: mode === 'text' ? text : undefined,
          watermarkImage: mode === 'image' ? wmFiles[0] : undefined,
          position,
          opacity: opacity / 100,
          fontSize: mode === 'image' ? fontSize : fontSize,
          color,
          rotation,
          padding,
        },
        (pct, phase) => {
          setProgress(pct);
          setStatus(phase === 'processing' ? 'processing' : 'uploading');
        },
      );
      setStatus('done');
      setProgress(100);
      setResult(res);
      downloadBlob(res.blob, res.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Watermark failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Watermark Studio — Add Text or Image Watermarks"
        description="Add text or image watermarks to your photos. Control position, opacity, size, and style. Free online watermark tool."
        path="/watermark"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Watermark Studio</h1>
        <p className="mt-2 text-gray-600">
          Protect your images with text or image watermarks — adjust position, opacity, and style.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop your main image here"
        description="Upload the image to watermark (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Settings — full width on top */}
          <div className="space-y-6">
            {/* Mode toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Watermark Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('text')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    mode === 'text' ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Type className={`w-5 h-5 ${mode === 'text' ? 'text-rose-600' : 'text-gray-400'}`} />
                  <span className={`font-semibold text-sm ${mode === 'text' ? 'text-rose-700' : 'text-gray-700'}`}>
                    Text
                  </span>
                </button>
                <button
                  onClick={() => setMode('image')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    mode === 'image' ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <ImageIcon className={`w-5 h-5 ${mode === 'image' ? 'text-rose-600' : 'text-gray-400'}`} />
                  <span className={`font-semibold text-sm ${mode === 'image' ? 'text-rose-700' : 'text-gray-700'}`}>
                    Image / Logo
                  </span>
                </button>
              </div>
            </div>

            {/* Text watermark settings */}
            {mode === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Watermark Text</label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
                    placeholder="Enter watermark text…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Font Size: {fontSize}px</label>
                    <input
                      type="range"
                      min="12"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
                      />
                      <span className="text-sm text-gray-500">{color}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image watermark upload */}
            {mode === 'image' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Watermark Image / Logo</label>
                  <FileDropzone
                    files={wmFiles}
                    onFilesChange={setWmFiles}
                    multiple={false}
                    label="Drop your logo or watermark image"
                    description="PNG with transparency works best"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size: {fontSize}%</label>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Small</span>
                    <span>Large</span>
                  </div>
                </div>
              </div>
            )}

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Position</label>
              <div className="flex flex-wrap gap-2">
                {POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPosition(p.value)}
                    className={`px-3 py-2 rounded-xl border-2 text-sm transition-all ${
                      position === p.value
                        ? 'border-rose-500 bg-rose-50 text-rose-700 font-semibold'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opacity: {opacity}%</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rotation: {rotation}°</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Padding: {padding}px</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={padding}
                  onChange={(e) => setPadding(parseInt(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Live preview + output side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {originalPreview && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Live Preview</label>
                <div ref={previewRef} className="relative inline-block rounded-xl overflow-hidden border border-gray-200 w-full">
                    <img
                      ref={previewImgRef}
                      src={originalPreview}
                      alt="Preview"
                      className="block w-full"
                      style={{ maxHeight: '500px', objectFit: 'contain' }}
                      onLoad={() => {
                        if (previewImgRef.current && imgDims) {
                          setPreviewScale(previewImgRef.current.clientWidth / imgDims.w);
                        }
                      }}
                    />
                    {/* CSS-based watermark overlay */}
                    {mode === 'text' && text && position !== 'repeated' && position !== 'strip' && (
                      <div
                        className="absolute pointer-events-none whitespace-nowrap"
                        style={{
                          ..._getPositionStyle(position, padding, previewScale),
                          fontSize: `${Math.max(8, fontSize * previewScale)}px`,
                          color: color,
                          opacity: opacity / 100,
                          transform: rotation ? `rotate(${rotation}deg)` : undefined,
                          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                          fontWeight: 'bold',
                        }}
                      >
                        {text}
                      </div>
                    )}
                    {mode === 'text' && text && position === 'repeated' && (
                      <div
                        className="absolute inset-0 pointer-events-none overflow-hidden flex flex-wrap content-start gap-8 p-4"
                        style={{ opacity: opacity / 100 }}
                      >
                        {Array.from({ length: 20 }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: `${Math.max(8, fontSize * previewScale)}px`,
                              color: color,
                              transform: rotation ? `rotate(${rotation}deg)` : undefined,
                              textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                              fontWeight: 'bold',
                            }}
                          >
                            {text}
                          </span>
                        ))}
                      </div>
                    )}
                    {mode === 'text' && text && position === 'strip' && (
                      <div
                        className="absolute left-0 right-0 bottom-0 pointer-events-none text-center py-2"
                        style={{
                          fontSize: `${Math.max(8, fontSize * previewScale)}px`,
                          color: color,
                          opacity: opacity / 100,
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                          fontWeight: 'bold',
                        }}
                      >
                        {text}
                      </div>
                    )}
                    {mode === 'image' && wmImagePreview && position !== 'repeated' && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          ..._getPositionStyle(position, padding, previewScale),
                          opacity: opacity / 100,
                          transform: rotation ? `rotate(${rotation}deg)` : undefined,
                          width: `${fontSize}%`,
                        }}
                      >
                        <img src={wmImagePreview} alt="Watermark" className="w-full h-auto" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Approximate preview — final output is rendered server-side.</p>
                </div>
              )}

            {/* Output result — second column */}
            {result && status === 'done' && (
              <ImagePreview src={result.previewUrl} alt="Watermarked" label="Watermarked" />
            )}
          </div>

          {result && status === 'done' && (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <Droplets className="w-5 h-5 text-rose-600" />
                <span className="font-semibold text-rose-800">Watermark applied!</span>
              </div>
            </div>
          )}

          <ProgressBar progress={progress} status={status} message={error} processingMessage="Applying watermark…" />

          <div className="flex gap-3">
            <button
              onClick={handleApply}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-rose-500/25"
            >
              <Droplets className="w-5 h-5" />
              Apply Watermark
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-rose-700 font-semibold rounded-xl border-2 border-rose-200 hover:bg-rose-50 transition-colors"
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
