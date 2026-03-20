import { useState, useCallback, useEffect } from 'react';
import { Download, Camera } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { createPassportPhoto, downloadBlob, getPassportPresets, PassportPreset, PassportResult } from '../api';
import SEOHead from '../components/SEOHead';

export default function PassportPhotoPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [presets, setPresets] = useState<Record<string, PassportPreset>>({});
  const [selectedPreset, setSelectedPreset] = useState('2x2');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PassportResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);

  useEffect(() => {
    getPassportPresets()
      .then(setPresets)
      .catch(() => {
        // Fallback presets if API is not available
        setPresets({
          '2x2': { width: 2, height: 2, label: 'US Passport (2×2 in)' },
          '35x45': { width: 35, height: 45, label: 'EU/UK Passport (35×45 mm)' },
          '33x48': { width: 33, height: 48, label: 'India Passport (33×48 mm)' },
          '51x51': { width: 51, height: 51, label: 'Canada Passport (51×51 mm)' },
        });
      });
  }, []);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    setOffsetX(0);
    setOffsetY(0);

    if (newFiles.length > 0) {
      setOriginalPreview(URL.createObjectURL(newFiles[0]));
    } else {
      setOriginalPreview(null);
    }
  }, []);

  const handleCreate = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const res = await createPassportPhoto(files[0], selectedPreset, bgColor, offsetX, offsetY, (pct, phase) => {
        setProgress(pct);
        setStatus(phase === 'processing' ? 'processing' : 'uploading');
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Passport photo creation failed');
    }
  };

  const BG_COLORS = [
    { label: 'White', value: '#FFFFFF' },
    { label: 'Light Blue', value: '#DBEAFE' },
    { label: 'Light Gray', value: '#F3F4F6' },
    { label: 'Red', value: '#EF4444' },
    { label: 'Blue', value: '#3B82F6' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Passport Photo Creator — Free Online Passport Photo Maker"
        description="Create passport photos online for free. Multiple size presets, custom background color, and face position adjustment. No sign-up required."
        path="/passport-photo"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Passport Photo Creator</h1>
        <p className="mt-2 text-gray-600">
          Upload a photo and create a passport-style image with the correct dimensions.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop a photo here"
        description="Upload a photo for your passport (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Preset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Photo Size</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(presets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPreset(key)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedPreset === key
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className={`font-semibold text-sm ${selectedPreset === key ? 'text-pink-700' : 'text-gray-700'}`}>
                    {preset.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Background Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              {BG_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setBgColor(c.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                    bgColor === c.value
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-gray-300"
                    style={{ backgroundColor: c.value }}
                  />
                  <span className="text-sm text-gray-700">{c.label}</span>
                </button>
              ))}
              {/* Custom color picker */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0"
                />
                <span className="text-sm text-gray-500">Custom</span>
              </div>
            </div>
          </div>

          {/* Face Position Adjustment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Face Position Offset</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Horizontal (px)</label>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  value={offsetX}
                  onChange={(e) => setOffsetX(parseInt(e.target.value))}
                  className="w-full accent-pink-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>← Left</span>
                  <span className="font-medium text-gray-600">{offsetX}px</span>
                  <span>Right →</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vertical (px)</label>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  value={offsetY}
                  onChange={(e) => setOffsetY(parseInt(e.target.value))}
                  className="w-full accent-pink-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>↑ Up</span>
                  <span className="font-medium text-gray-600">{offsetY}px</span>
                  <span>Down ↓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress */}
          <ProgressBar
            progress={progress}
            status={status}
            message={error}
            processingMessage="Creating passport photo…"
          />

          {/* Previews */}
          {(originalPreview || result) && status !== 'uploading' && status !== 'processing' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {originalPreview && (
                <ImagePreview src={originalPreview} alt="Original" label="Original Photo" />
              )}
              {result && (
                <ImagePreview src={result.previewUrl} alt="Passport Photo" label="Passport Photo" />
              )}
            </div>
          )}

          {result && status === 'done' && (
            <div className="p-5 bg-pink-50 border border-pink-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-pink-600" />
                <span className="font-semibold text-pink-800">Passport photo created!</span>
              </div>
              <p className="text-sm text-pink-600 mt-1">
                Size: {presets[selectedPreset]?.label || selectedPreset} at 300 DPI.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-pink-600 text-white font-semibold rounded-xl hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-pink-500/25"
            >
              <Camera className="w-5 h-5" />
              Create Passport Photo
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-pink-700 font-semibold rounded-xl border-2 border-pink-200 hover:bg-pink-50 transition-colors"
              >
                <Download className="w-5 h-5 inline mr-1" />
                Download
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
