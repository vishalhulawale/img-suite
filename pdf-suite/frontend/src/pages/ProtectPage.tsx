import { useState } from 'react';
import { Download, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import { protectPDF, downloadBlob, checkPdfEncrypted } from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

export default function ProtectPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showUserPwd, setShowUserPwd] = useState(false);
  const [showOwnerPwd, setShowOwnerPwd] = useState(false);
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [allowModify, setAllowModify] = useState(false);
  const [allowAnnotate, setAllowAnnotate] = useState(true);
  const [encryption, setEncryption] = useState<'AES-256' | 'AES-128' | 'RC4-128'>('AES-256');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [alreadyEncrypted, setAlreadyEncrypted] = useState(false);

  const handleProtect = async () => {
    if (!files[0] || !userPassword) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      const result = await protectPDF(files[0], {
        userPassword,
        ownerPassword,
        allowPrint,
        allowCopy,
        allowModify,
        allowAnnotate,
        encryption,
      }, (pct) => {
        setProgress(pct);
        if (pct >= 100) setStatus('processing');
      });

      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Protection failed');
    }
  };

  const permissions = [
    { label: 'Allow printing', checked: allowPrint, onChange: (v: boolean) => { setAllowPrint(v); if (status === 'done') { setStatus('idle'); setProgress(0); } } },
    { label: 'Allow copying text', checked: allowCopy, onChange: (v: boolean) => { setAllowCopy(v); if (status === 'done') { setStatus('idle'); setProgress(0); } } },
    { label: 'Allow modifying content', checked: allowModify, onChange: (v: boolean) => { setAllowModify(v); if (status === 'done') { setStatus('idle'); setProgress(0); } } },
    { label: 'Allow annotations', checked: allowAnnotate, onChange: (v: boolean) => { setAllowAnnotate(v); if (status === 'done') { setStatus('idle'); setProgress(0); } } },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Protect PDF — Password Protect & Encrypt PDF Free"
        description="Protect PDF with a password for free — add AES-256 encryption to secure your documents. Free online tool, no sign-up required."
        path="/protect"
      />
      <JsonLd data={toolSchema('Protect PDF — Free Online Tool', 'Add password protection and encryption to secure your PDF for free.', 'https://smartpdfsuite.com/protect')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Protect PDF</h1>
        <p className="mt-2 text-gray-600">
          Add password protection and encryption to secure your PDF.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={async (newFiles) => {
          setFiles(newFiles);
          setAlreadyEncrypted(false);
          if (status === 'done') { setStatus('idle'); setProgress(0); }
          if (newFiles.length > 0) {
            try {
              const encrypted = await checkPdfEncrypted(newFiles[0]);
              setAlreadyEncrypted(encrypted);
            } catch { /* ignore check failure */ }
          }
        }}
        multiple={false}
        label="Drop a PDF to protect"
        description="Upload a PDF file to add password protection"
      />

      {files.length > 0 && alreadyEncrypted && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">This PDF is already password-protected</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Remove the existing protection first using the <a href="/unlock" className="underline">Unlock PDF</a> tool, then re-protect with a new password.
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && !alreadyEncrypted && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showUserPwd ? 'text' : 'password'}
                  value={userPassword}
                  onChange={(e) => { setUserPassword(e.target.value); if (status === 'done') { setStatus('idle'); setProgress(0); } }}
                  placeholder="Required to open PDF"
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowUserPwd(!showUserPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showUserPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Password <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type={showOwnerPwd ? 'text' : 'password'}
                  value={ownerPassword}
                  onChange={(e) => { setOwnerPassword(e.target.value); if (status === 'done') { setStatus('idle'); setProgress(0); } }}
                  placeholder="For editing permissions"
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnerPwd(!showOwnerPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showOwnerPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {ownerPassword && ownerPassword === userPassword && (
                <p className="mt-1.5 text-xs text-amber-600">
                  Owner password should differ from user password for permissions to be enforced.
                </p>
              )}
              <p className="mt-1.5 text-xs text-gray-400">
                If left empty, a random owner password will be generated automatically.
              </p>
            </div>
          </div>

          {/* Encryption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Encryption</label>
            <div className="flex gap-3">
              {(['AES-256', 'AES-128', 'RC4-128'] as const).map((enc) => (
                <button
                  key={enc}
                  onClick={() => { setEncryption(enc); if (status === 'done') { setStatus('idle'); setProgress(0); } }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    encryption === enc
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${encryption === enc ? 'text-orange-600' : 'text-gray-400'}`} />
                  {enc}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
            <div className="grid grid-cols-2 gap-3">
              {permissions.map((perm) => (
                <label
                  key={perm.label}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={perm.checked}
                    onChange={(e) => perm.onChange(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Protecting PDF — this may take a moment…" />
          </div>

          <div className="mt-8">
            <button
              onClick={handleProtect}
              disabled={!files[0] || !userPassword || alreadyEncrypted || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-orange-500/25"
            >
              <Lock className="w-5 h-5" />
              Protect & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
