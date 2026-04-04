import { useState, useCallback } from 'react';
import { Download, Sparkles } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { enhanceImage, downloadBlob, EnhanceResult } from '../api';
import SEOHead from '../components/SEOHead';

type Intensity = 'low' | 'medium' | 'high';

const INTENSITIES: { value: Intensity; label: string; desc: string }[] = [
  { value: 'low', label: 'Subtle', desc: 'Light touch-up, very natural' },
  { value: 'medium', label: 'Balanced', desc: 'Noticeable improvement, still natural' },
  { value: 'high', label: 'Strong', desc: 'Vivid colors, sharp details' },
];

export default function AutoEnhancePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<EnhanceResult | null>(null);
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

  const handleEnhance = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await enhanceImage(files[0], intensity, (pct, phase) => {
        setProgress(pct);
        setStatus(phase === 'processing' ? 'processing' : 'uploading');
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Enhancement failed');
    }
  };

  const handleReset = () => {
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Auto Enhance — Make Images Look Better Instantly"
        description="Enhance images with one click — automatically improve brightness, contrast, saturation, and sharpness. Free, no sign-up."
        path="/auto-enhance"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Auto Enhance</h1>
        <p className="mt-2 text-gray-600">
          Make dull images look better in one click — adjusts brightness, contrast, color, and sharpness.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop an image to enhance"
        description="Upload a photo to automatically improve (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 animate-fade-in">
          <label className="block text-sm font-medium text-gray-700 mb-3">Enhancement Strength</label>
          <div className="grid grid-cols-3 gap-3">
            {INTENSITIES.map((i) => (
              <button
                key={i.value}
                onClick={() => setIntensity(i.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  intensity === i.value
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className={`font-semibold text-sm ${intensity === i.value ? 'text-amber-700' : 'text-gray-700'}`}>
                  {i.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{i.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <>
          {/* Previews — always visible */}
          {originalPreview && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImagePreview src={originalPreview} alt="Original" label="Before" />
              {result && (
                <ImagePreview src={result.previewUrl} alt="Enhanced" label="After" />
              )}
            </div>
          )}

          {result && status === 'done' && (
            <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span className="font-semibold text-amber-800">Image enhanced!</span>
              </div>
              <p className="text-sm text-amber-600 mt-1">
                Applied {intensity} enhancement — brightness, contrast, saturation, and sharpness improved.
              </p>
            </div>
          )}

          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Enhancing image…" />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleEnhance}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-amber-500/25"
            >
              <Sparkles className="w-5 h-5" />
              Enhance Image
            </button>
            {result && (
              <>
                <button
                  onClick={handleReset}
                  className="px-4 py-3.5 bg-white text-gray-600 font-semibold rounded-xl border-2 border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => downloadBlob(result.blob, result.filename)}
                  className="px-6 py-3.5 bg-white text-amber-700 font-semibold rounded-xl border-2 border-amber-200 hover:bg-amber-50 transition-colors"
                >
                  <Download className="w-5 h-5 inline mr-1" />
                  Download
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
