import { useState, useCallback } from 'react';
import { Download, TrendingDown } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { compressImage, downloadBlob, CompressResult } from '../api';
import SEOHead from '../components/SEOHead';

type Level = 'low' | 'medium' | 'high';

export default function CompressPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<Level>('medium');
  const [targetSizeKb, setTargetSizeKb] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompressResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');

    // Create original preview
    if (newFiles.length > 0) {
      const url = URL.createObjectURL(newFiles[0]);
      setOriginalPreview(url);
    } else {
      setOriginalPreview(null);
    }
  }, []);

  const handleCompress = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const targetKb = targetSizeKb ? parseInt(targetSizeKb, 10) : null;
      const res = await compressImage(files[0], level, targetKb, (pct, phase) => {
        setProgress(pct);
        setStatus(phase === 'processing' ? 'processing' : 'uploading');
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Compression failed');
    }
  };

  const levels: { value: Level; label: string; desc: string }[] = [
    { value: 'low', label: 'Low', desc: 'High quality, slight compression' },
    { value: 'medium', label: 'Medium', desc: 'Balanced quality & size' },
    { value: 'high', label: 'High', desc: 'Max compression, lower quality' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Compress Image — Reduce Image File Size Online Free"
        description="Compress images online for free — reduce file size with adjustable quality or target size. No sign-up, no install."
        path="/compress"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compress Image</h1>
        <p className="mt-2 text-gray-600">
          Reduce image file size with adjustable compression levels or a target size limit.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop an image file here"
        description="Upload an image to compress (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 animate-fade-in">
          <label className="block text-sm font-medium text-gray-700 mb-3">Compression Level</label>
          <div className="grid grid-cols-3 gap-3">
            {levels.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  level === l.value
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className={`font-semibold text-sm ${level === l.value ? 'text-green-700' : 'text-gray-700'}`}>
                  {l.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{l.desc}</p>
              </button>
            ))}
          </div>

          {/* Target size */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Size (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="10"
                max="10000"
                placeholder="e.g. 500"
                value={targetSizeKb}
                onChange={(e) => setTargetSizeKb(e.target.value)}
                className="w-40 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              />
              <span className="text-sm text-gray-500">KB</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave empty to use the compression level only.</p>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Compressing image…" />
          </div>

          {/* Previews */}
          {(originalPreview || result) && status !== 'uploading' && status !== 'processing' && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {originalPreview && (
                <ImagePreview src={originalPreview} alt="Original" label="Original" />
              )}
              {result && (
                <ImagePreview src={result.previewUrl} alt="Compressed" label="Compressed" />
              )}
            </div>
          )}

          {/* Results */}
          {result && status === 'done' && (
            <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <TrendingDown className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Compression Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Original</p>
                  <p className="font-semibold text-gray-800">{formatSize(result.originalSize)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Compressed</p>
                  <p className="font-semibold text-green-700">{formatSize(result.compressedSize)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Saved</p>
                  <p className="font-semibold text-green-700">{result.ratio}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              onClick={handleCompress}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-500/25"
            >
              <Download className="w-5 h-5" />
              Compress & Download
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-green-700 font-semibold rounded-xl border-2 border-green-200 hover:bg-green-50 transition-colors"
              >
                Download Again
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
