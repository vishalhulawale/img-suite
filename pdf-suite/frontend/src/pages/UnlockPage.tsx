import { useState } from 'react';
import { Download, Unlock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import { unlockPDF, downloadBlob, checkPdfEncrypted } from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

export default function UnlockPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [notEncrypted, setNotEncrypted] = useState(false);

  const handleUnlock = async () => {
    if (!files[0] || !password) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      const result = await unlockPDF(files[0], password, (pct) => {
        setProgress(pct);
        if (pct >= 100) setStatus('processing');
      });

      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      const detail = err?.response?.data;
      // Handle blob error response
      let msg = 'Unlock failed';
      if (detail instanceof Blob) {
        try {
          const text = await detail.text();
          const json = JSON.parse(text);
          msg = json.detail || msg;
        } catch {
          // ignore parse error
        }
      } else if (typeof detail === 'object' && detail?.detail) {
        msg = detail.detail;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Unlock PDF — Remove Password Protection Free"
        description="Unlock PDF for free — remove password protection from any PDF document online. Free PDF unlocker, no sign-up needed."
        path="/unlock"
      />
      <JsonLd data={toolSchema('Unlock PDF — Free Online Tool', 'Remove password protection from a PDF document for free online.', 'https://smartpdfsuite.com/unlock')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Unlock PDF</h1>
        <p className="mt-2 text-gray-600">
          Remove password protection from a PDF document.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={async (newFiles) => {
          setFiles(newFiles);
          setNotEncrypted(false);
          if (status === 'done' || status === 'error') { setStatus('idle'); setProgress(0); setError(''); }
          if (newFiles.length > 0) {
            try {
              const encrypted = await checkPdfEncrypted(newFiles[0]);
              setNotEncrypted(!encrypted);
            } catch { /* ignore check failure */ }
          }
        }}
        multiple={false}
        label="Drop a password-protected PDF"
        description="Upload the PDF you want to unlock"
      />

      {files.length > 0 && notEncrypted && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-teal-50 rounded-xl border border-teal-200">
          <AlertTriangle className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-teal-800">This PDF is not password-protected</p>
            <p className="text-xs text-teal-600 mt-0.5">
              This file doesn't appear to have password protection. No unlocking is needed.
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && !notEncrypted && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-teal-50 rounded-xl border border-teal-200">
            <AlertTriangle className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-teal-800">Password required</p>
              <p className="text-xs text-teal-600 mt-0.5">
                Enter the password used to protect this PDF. The output will be a new
                PDF without any password restrictions.
              </p>
            </div>
          </div>

          {/* Password input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDF Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter the PDF password"
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlock();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Unlocking PDF — this may take a moment…" />
          </div>

          <div className="mt-8">
            <button
              onClick={handleUnlock}
              disabled={!files[0] || !password || notEncrypted || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-teal-500/25"
            >
              <Unlock className="w-5 h-5" />
              Unlock & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
