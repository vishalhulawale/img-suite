import { useState } from 'react';
import { Download, FileImage, FileSpreadsheet, FileText, Presentation, Upload, ArrowRight, AlertTriangle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import {
  convertToImages, convertToDocx, convertToXlsx, convertToPptx,
  convertToPdf, downloadBlob, checkPdfEncrypted,
  type ConvertProgressCb,
} from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

type ConvertTarget = 'images' | 'docx' | 'xlsx' | 'pptx';
type ConvertMode = 'from-pdf' | 'to-pdf';

const ACCEPT_TO_PDF: Record<string, string[]> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

export default function ConvertPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ConvertMode>('from-pdf');
  const [target, setTarget] = useState<ConvertTarget>('images');
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [dpi, setDpi] = useState(150);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);

  const handleConvert = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setProgressMessage('');

    try {
      let result: { blob: Blob; filename: string } | undefined;
      const onProg: ConvertProgressCb = (pct, phase, message) => {
        setProgress(pct);
        if (phase === 'uploading') setStatus('uploading');
        else if (phase === 'processing' || phase === 'downloading') setStatus('processing');
        if (message) setProgressMessage(message);
      };

      if (mode === 'to-pdf') {
        result = await convertToPdf(files[0], onProg);
      } else {
        switch (target) {
          case 'images':
            result = await convertToImages(files[0], format, dpi, onProg);
            break;
          case 'docx':
            result = await convertToDocx(files[0], onProg);
            break;
          case 'xlsx':
            result = await convertToXlsx(files[0], onProg);
            break;
          case 'pptx':
            result = await convertToPptx(files[0], onProg);
            break;
        }
      }

      if (!result) throw new Error('Unsupported conversion');
      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Conversion failed');
    }
  };

  // Helper to get the correct processing message
  const getProcessingMessage = () => {
    if (mode === 'to-pdf') return 'Converting to PDF — this may take a moment…';
    switch (target) {
      case 'images': return 'Converting PDF to images — this may take a moment…';
      case 'docx': return 'Converting PDF to Word — this may take a moment…';
      case 'xlsx': return 'Converting PDF to Excel — this may take a moment…';
      case 'pptx': return 'Converting PDF to PowerPoint — this may take a moment…';
      default: return 'Processing…';
    }
  };

  // Reset status and error when target or mode changes
  const handleTargetChange = (t: ConvertTarget) => {
    setTarget(t);
    setStatus('idle');
    setError('');
    setProgress(0);
    setProgressMessage('');
  };
  const handleModeChange = (m: ConvertMode) => {
    setMode(m);
    setStatus('idle');
    setError('');
    setProgress(0);
    setProgressMessage('');
    setIsEncrypted(false);
    resetFiles();
  };

  const fromPdfTargets = [
    { value: 'images' as ConvertTarget, label: 'Images', desc: 'PNG or JPG per page', icon: FileImage, beta: false, color: 'text-sky-500' },
    { value: 'docx' as ConvertTarget, label: 'Word', desc: 'DOCX with text layout', icon: FileText, beta: false, color: 'text-blue-600' },
    { value: 'xlsx' as ConvertTarget, label: 'Excel', desc: 'Extract tables', icon: FileSpreadsheet, beta: false, color: 'text-green-600' },
    { value: 'pptx' as ConvertTarget, label: 'PowerPoint', desc: 'PPTX slides', icon: Presentation, beta: false, color: 'text-orange-500' },
  ];

  const resetFiles = () => {
    setFiles([]);
    setStatus('idle');
    setProgress(0);
    setError('');
    setProgressMessage('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Convert PDF — PDF to Word, Excel, Images & More"
        description="Convert PDF to Word, Excel, PowerPoint, and images for free. Free online PDF converter — no sign-up, no install required."
        path="/convert"
      />
      <JsonLd data={toolSchema('Convert PDF — Free Online Tool', 'Convert PDF to Word, Excel, PowerPoint, and images for free online.', 'https://smartpdfsuite.com/convert')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Convert PDF</h1>
        <p className="mt-2 text-gray-600">
          Convert between PDF and other formats — Word, Excel, PowerPoint, and images.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
        <button
          onClick={() => { handleModeChange('from-pdf'); }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'from-pdf'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          PDF <ArrowRight className="w-4 h-4" /> Other
        </button>
        <button
          onClick={() => { handleModeChange('to-pdf'); }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            mode === 'to-pdf'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Other <ArrowRight className="w-4 h-4" /> PDF
        </button>
      </div>

      {mode === 'from-pdf' ? (
        <FileDropzone
          files={files}
          onFilesChange={async (newFiles) => {
            setFiles(newFiles);
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
          description="Upload a PDF to convert"
        />
      ) : (
        <FileDropzone
          files={files}
          onFilesChange={setFiles}
          multiple={false}
          accept={ACCEPT_TO_PDF}
          label="Drop a file to convert to PDF"
          description="Supports DOCX, PPTX, XLSX, PNG, JPG, WebP"
        />
      )}

      {files.length > 0 && mode === 'from-pdf' && isEncrypted && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">This PDF is password-protected</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please remove the password protection first using the{' '}
              <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before converting.
            </p>
          </div>
        </div>
      )}

      {files.length > 0 && mode === 'from-pdf' && !isEncrypted && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Target selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Convert To</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fromPdfTargets.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => handleTargetChange(t.value)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      target === t.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {t.beta && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
                        Beta
                      </span>
                    )}
                    <Icon className={`w-5 h-5 mb-2 ${t.color}`} />
                    <p className={`font-semibold text-sm ${target === t.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image-specific options */}
          {target === 'images' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'png' | 'jpg')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value={72}>72 DPI (Screen)</option>
                  <option value={150}>150 DPI (Standard)</option>
                  <option value={300}>300 DPI (Print)</option>
                  <option value={600}>600 DPI (High Quality)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {files.length > 0 && mode === 'to-pdf' && (
        <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-fade-in">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="font-semibold text-sm text-indigo-800">Ready to convert</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                {files[0].name} → PDF
              </p>
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && !(mode === 'from-pdf' && isEncrypted) && (
        <>
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage={progressMessage || getProcessingMessage()} />
          </div>

          <div className="mt-8">
            <button
              onClick={handleConvert}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/25"
            >
              <Download className="w-5 h-5" />
              Convert & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
