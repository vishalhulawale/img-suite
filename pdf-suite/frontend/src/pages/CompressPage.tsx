import { useState, useCallback } from 'react';
import { Download, TrendingDown, AlertTriangle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import { compressPDF, downloadBlob, CompressResult, checkPdfEncrypted } from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

type Level = 'low' | 'medium' | 'high';

export default function CompressPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<Level>('medium');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [result, setResult] = useState<CompressResult | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Clear previous results whenever files change
  const handleFilesChange = useCallback(async (newFiles: File[]) => {
    setFiles(newFiles);
    // Reset all compression state when file is removed or changed
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    setIsEncrypted(false);
    if (newFiles.length > 0) {
      try {
        const encrypted = await checkPdfEncrypted(newFiles[0]);
        setIsEncrypted(encrypted);
      } catch { /* ignore check failure */ }
    }
  }, []);

  const handleCompress = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await compressPDF(files[0], level, (pct, phase) => {
        setProgress(pct);
        if (phase === 'processing') {
          setStatus('processing');
        } else {
          setStatus('uploading');
        }
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
      downloadBlob(res.blob, res.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Compression failed');
    }
  };

  const levels: { value: Level; label: string; desc: string; color: string }[] = [
    { value: 'low', label: 'Low', desc: 'High quality, slight compression', color: 'green' },
    { value: 'medium', label: 'Medium', desc: 'Balanced quality & size', color: 'amber' },
    { value: 'high', label: 'High', desc: 'Max compression, lower quality', color: 'red' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Compress PDF — Reduce PDF File Size Online Free"
        description="Compress PDF online for free — reduce file size with adjustable quality. Shrink PDFs for email and sharing. No sign-up, no install."
        path="/compress"
      />
      <JsonLd data={toolSchema('Compress PDF — Free Online Tool', 'Reduce PDF file size online for free with adjustable compression levels.', 'https://smartpdfsuite.com/compress')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compress PDF</h1>
        <p className="mt-2 text-gray-600">
          Reduce PDF file size with adjustable compression levels.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop a PDF file here"
        description="Upload a PDF to compress"
      />

      {files.length > 0 && isEncrypted && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">This PDF is password-protected</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please remove the password protection first using the{' '}
              <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before compressing.
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && !isEncrypted && (
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
        </div>
      )}

      {files.length > 0 && !isEncrypted && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} />
          </div>

          {/* Compression results */}
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

          <div className="mt-8">
            <button
              onClick={handleCompress}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-500/25"
            >
              <Download className="w-5 h-5" />
              Compress & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
