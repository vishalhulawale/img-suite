import { useState, useCallback } from 'react';
import { Download, Scissors } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { removeBackground, downloadBlob, RemoveBgResult } from '../api';
import SEOHead from '../components/SEOHead';

export default function RemoveBackgroundPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<RemoveBgResult | null>(null);
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

  const handleRemove = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await removeBackground(files[0], (pct, phase) => {
        setProgress(pct);
        setStatus(phase === 'processing' ? 'processing' : 'uploading');
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Background removal failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Remove Background — Free Online Background Remover"
        description="Remove image backgrounds automatically for free. Get transparent PNG output in seconds. No sign-up, no install."
        path="/remove-background"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Remove Background</h1>
        <p className="mt-2 text-gray-600">
          Upload an image and automatically remove the background. Download with transparent background.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop an image file here"
        description="Upload a photo to remove its background (PNG, JPG, WebP, AVIF)"
      />

      {files.length > 0 && (
        <>
          <div className="mt-6">
            <ProgressBar
              progress={progress}
              status={status}
              message={error}
              processingMessage="Removing background — this may take a moment…"
            />
          </div>

          {/* Previews — always show original, result only when done */}
          {originalPreview && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImagePreview src={originalPreview} alt="Original" label="Original" />
              {result && (
                <ImagePreview src={result.previewUrl} alt="Background Removed" label="Background Removed" />
              )}
            </div>
          )}

          {result && status === 'done' && (
            <div className="mt-6 p-5 bg-purple-50 border border-purple-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <Scissors className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-purple-800">Background removed successfully!</span>
              </div>
              <p className="text-sm text-purple-600 mt-1">The result is a PNG with a transparent background.</p>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              onClick={handleRemove}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/25"
            >
              <Scissors className="w-5 h-5" />
              Remove Background
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-purple-700 font-semibold rounded-xl border-2 border-purple-200 hover:bg-purple-50 transition-colors"
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
