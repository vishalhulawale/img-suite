import { useState, useCallback, useEffect } from 'react';
import { Download, RefreshCw, ArrowRightLeft } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { convertImage, downloadBlob, ConvertResult } from '../api';
import SEOHead from '../components/SEOHead';

type Format = 'jpg' | 'png' | 'webp' | 'avif';

const FORMATS: { value: Format; label: string; desc: string }[] = [
  { value: 'jpg', label: 'JPG', desc: 'Best for photos, small size' },
  { value: 'png', label: 'PNG', desc: 'Supports transparency, lossless' },
  { value: 'webp', label: 'WebP', desc: 'Modern format, great compression' },
  { value: 'avif', label: 'AVIF', desc: 'Next-gen format, excellent compression' },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FormatConverterPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<Format>('png');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    if (newFiles.length > 0) {
      setOriginalPreview(URL.createObjectURL(newFiles[0]));
    } else {
      setOriginalPreview(null);
    }
  }, []);

  const sourceExt = files[0]?.name.split('.').pop()?.toLowerCase() || '';
  const sourceHasAlpha = sourceExt === 'png' || sourceExt === 'webp';
  const showTransparencyWarning = sourceHasAlpha && targetFormat === 'jpg';

  // Auto-select first format that isn't the source format
  useEffect(() => {
    if (!sourceExt) return;
    const normalised = sourceExt === 'jpeg' ? 'jpg' : sourceExt;
    if (normalised === targetFormat) {
      const alt = FORMATS.find((f) => f.value !== normalised);
      if (alt) setTargetFormat(alt.value);
    }
  }, [sourceExt]);

  const handleConvert = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await convertImage(files[0], targetFormat, 85, (pct, phase) => {
        setProgress(pct);
        setStatus(phase === 'processing' ? 'processing' : 'uploading');
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
      downloadBlob(res.blob, res.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Conversion failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Format Converter — Convert Images Between JPG, PNG, WebP"
        description="Convert images between JPG, PNG, and WebP formats for free. Adjust quality, handle transparency. No sign-up required."
        path="/format-converter"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Format Converter</h1>
        <p className="mt-2 text-gray-600">
          Convert images between JPG, PNG, and WebP — fast and free.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop an image file here"
        description="Upload an image to convert (PNG, JPG, WebP, AVIF)"
      />

      {files.length > 0 && (
        <div className="mt-8 animate-fade-in">
          {/* Format selection */}
          <label className="block text-sm font-medium text-gray-700 mb-3">Convert to</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FORMATS.map((f) => {
              const isSameFormat = sourceExt === f.value || (sourceExt === 'jpeg' && f.value === 'jpg');
              return (
                <button
                  key={f.value}
                  onClick={() => !isSameFormat && setTargetFormat(f.value)}
                  disabled={isSameFormat}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSameFormat
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : targetFormat === f.value
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`font-semibold text-sm ${isSameFormat ? 'text-gray-400' : targetFormat === f.value ? 'text-teal-700' : 'text-gray-700'}`}>
                    {f.label}{isSameFormat ? ' (current)' : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Transparency warning */}
          {showTransparencyWarning && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <strong>Note:</strong> JPG does not support transparency. Transparent areas will be filled with white.
            </div>
          )}
        </div>
      )}

      {files.length > 0 && (
        <>
          {/* Previews — always visible */}
          {originalPreview && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImagePreview src={originalPreview} alt="Original" label={`Original (${sourceExt.toUpperCase()})`} />
              {result && (
                <ImagePreview src={result.previewUrl} alt="Converted" label={`Converted (${targetFormat.toUpperCase()})`} />
              )}
            </div>
          )}

          {result && status === 'done' && (
            <div className="mt-6 p-5 bg-teal-50 border border-teal-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <RefreshCw className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-teal-800">Conversion Complete</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Original ({result.originalFormat.toUpperCase()})</p>
                  <p className="font-semibold text-gray-800">{formatSize(result.originalSize)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Converted ({result.outputFormat.toUpperCase()})</p>
                  <p className="font-semibold text-teal-700">{formatSize(result.outputSize)}</p>
                </div>
              </div>
              {result.transparencyWarning && (
                <p className="mt-2 text-xs text-amber-600">{result.transparencyWarning}</p>
              )}
            </div>
          )}

          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Converting image…" />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleConvert}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-teal-500/25"
            >
              <RefreshCw className="w-5 h-5" />
              Convert to {targetFormat.toUpperCase()}
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-teal-700 font-semibold rounded-xl border-2 border-teal-200 hover:bg-teal-50 transition-colors"
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
