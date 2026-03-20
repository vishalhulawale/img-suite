import { useState, useCallback } from 'react';
import { Download, ZoomIn, Info } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { upscaleImage, downloadBlob, UpscaleResult } from '../api';
import SEOHead from '../components/SEOHead';

const SCALES = [
  { value: 2, label: '2×', desc: 'Double the resolution' },
  { value: 4, label: '4×', desc: 'Quadruple the resolution' },
];

export default function ImageUpscalerPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [scale, setScale] = useState(2);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<UpscaleResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    setImgDimensions(null);
    if (newFiles.length > 0) {
      const url = URL.createObjectURL(newFiles[0]);
      setOriginalPreview(url);
      const img = new Image();
      img.onload = () => setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    } else {
      setOriginalPreview(null);
    }
  }, []);

  const handleUpscale = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await upscaleImage(files[0], scale, (pct, phase) => {
        setProgress(pct);
        setStatus(phase === 'processing' ? 'processing' : 'uploading');
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Upscaling failed');
    }
  };

  const estW = imgDimensions ? imgDimensions.w * scale : 0;
  const estH = imgDimensions ? imgDimensions.h * scale : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Image Upscaler — Enlarge Images Without Losing Quality"
        description="Upscale images to 2× or 4× resolution with smart sharpening. Free online image enlarger — no sign-up required."
        path="/upscale"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Image Upscaler</h1>
        <p className="mt-2 text-gray-600">
          Enlarge images while keeping them sharp and clear.
        </p>
      </div>

      {/* Honest expectations note */}
      <div className="mb-6 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          This tool uses high-quality resampling with smart sharpening. It works best on images that are slightly too small. 
          Very tiny images (under 100px) will show some softness — that's a physical limitation, not a bug.
        </span>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop an image to upscale"
        description="Upload an image to enlarge (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 animate-fade-in">
          {/* Dimensions preview */}
          {imgDimensions && (
            <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Current size</p>
                  <p className="font-semibold text-gray-800">{imgDimensions.w} × {imgDimensions.h}</p>
                </div>
                <div className="text-gray-300">→</div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Output size ({scale}×)</p>
                  <p className="font-semibold text-indigo-700">{estW} × {estH}</p>
                </div>
              </div>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700 mb-3">Scale Factor</label>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {SCALES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScale(s.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  scale === s.value
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className={`font-bold text-lg ${scale === s.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {s.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Upscaling image…" />
          </div>

          {(originalPreview || result) && status !== 'uploading' && status !== 'processing' && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {originalPreview && (
                <ImagePreview
                  src={originalPreview}
                  alt="Original"
                  label={`Original${imgDimensions ? ` (${imgDimensions.w}×${imgDimensions.h})` : ''}`}
                />
              )}
              {result && (
                <ImagePreview
                  src={result.previewUrl}
                  alt="Upscaled"
                  label={`Upscaled ${result.scaleFactor}× (${result.outputWidth}×${result.outputHeight})`}
                />
              )}
            </div>
          )}

          {result && status === 'done' && (
            <div className="mt-6 p-5 bg-indigo-50 border border-indigo-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <ZoomIn className="w-5 h-5 text-indigo-600" />
                <span className="font-semibold text-indigo-800">Upscaling Complete</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Original</p>
                  <p className="font-semibold text-gray-800">{result.originalWidth} × {result.originalHeight}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Upscaled ({result.scaleFactor}×)</p>
                  <p className="font-semibold text-indigo-700">{result.outputWidth} × {result.outputHeight}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              onClick={handleUpscale}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/25"
            >
              <ZoomIn className="w-5 h-5" />
              Upscale {scale}×
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-indigo-700 font-semibold rounded-xl border-2 border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                <Download className="w-5 h-5 inline mr-1" />
                Download
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
