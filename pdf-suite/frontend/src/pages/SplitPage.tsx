import { useState } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import { splitPDF, downloadBlob, checkPdfEncrypted } from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

type SplitMode = 'ranges' | 'extract' | 'individual';

export default function SplitPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<SplitMode>('ranges');
  const [pages, setPages] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);

  const handleSplit = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      const result = await splitPDF(files[0], mode, pages, (pct) => {
        setProgress(pct);
        if (pct >= 100) setStatus('processing');
      });
      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Split failed');
    }
  };

  const modes: { value: SplitMode; label: string; desc: string }[] = [
    { value: 'ranges', label: 'By Page Ranges', desc: 'e.g., 1-5, 6-10' },
    { value: 'extract', label: 'Extract Pages', desc: 'e.g., 1, 3, 5, 7-9' },
    { value: 'individual', label: 'Individual Pages', desc: 'One PDF per page' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Split PDF — Extract Pages Online Free"
        description="Split PDF online for free — extract specific pages or divide into multiple documents. Supports page ranges. No sign-up, no install."
        path="/split"
      />
      <JsonLd data={toolSchema('Split PDF — Free Online Tool', 'Split a PDF into multiple documents or extract specific pages for free. No sign-up required.', 'https://smartpdfsuite.com/split')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Split PDF</h1>
        <p className="mt-2 text-gray-600">
          Split a PDF into multiple documents or extract specific pages.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={async (newFiles) => {
          setFiles(newFiles);
          if (newFiles.length === 0 || status === 'done') { setStatus('idle'); setProgress(0); setError(''); }
          setIsEncrypted(false);
          if (newFiles.length > 0) {
            try {
              const encrypted = await checkPdfEncrypted(newFiles[0]);
              setIsEncrypted(encrypted);
            } catch { /* ignore check failure */ }
          }
        }}
        multiple={false}
        label="Drop a PDF file here"
        description="Upload a single PDF to split"
      />

      {files.length > 0 && isEncrypted && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">This PDF is password-protected</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please remove the password protection first using the{' '}
              <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before splitting.
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && !isEncrypted && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Split Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {modes.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === m.value
                      ? 'border-lime-500 bg-lime-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`font-medium text-sm ${mode === m.value ? 'text-lime-700' : 'text-gray-700'}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Page Input */}
          {mode !== 'individual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pages</label>
              <input
                type="text"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder={mode === 'ranges' ? '1-5, 6-10, 11-15' : '1, 3, 5, 7-9'}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          )}
        </div>
      )}

      {files.length > 0 && !isEncrypted && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Splitting PDF — this may take a moment…" />
          </div>

          <div className="mt-8">
            <button
              onClick={handleSplit}
              disabled={!files[0] || (mode !== 'individual' && !pages) || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-lime-600 text-white font-semibold rounded-xl hover:bg-lime-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-lime-500/25"
            >
              <Download className="w-5 h-5" />
              Split & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
