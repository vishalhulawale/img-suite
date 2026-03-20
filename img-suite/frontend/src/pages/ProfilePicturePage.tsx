import { useState, useCallback, useEffect } from 'react';
import { Download, User } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { createProfilePicture, downloadBlob, getProfilePicPresets, ProfilePicPreset, ProfilePicResult } from '../api';
import SEOHead from '../components/SEOHead';

const PLATFORM_COLORS: Record<string, string> = {
  whatsapp: 'bg-green-50 border-green-500 text-green-700',
  instagram: 'bg-pink-50 border-pink-500 text-pink-700',
  linkedin: 'bg-blue-50 border-blue-500 text-blue-700',
  facebook: 'bg-blue-50 border-blue-500 text-blue-700',
  x: 'bg-gray-50 border-gray-500 text-gray-700',
  youtube: 'bg-red-50 border-red-500 text-red-700',
  discord: 'bg-indigo-50 border-indigo-500 text-indigo-700',
  custom: 'bg-violet-50 border-violet-500 text-violet-700',
};

const DEFAULT_PRESETS: Record<string, ProfilePicPreset> = {
  whatsapp: { size: 640, label: 'WhatsApp (640×640)' },
  instagram: { size: 1080, label: 'Instagram (1080×1080)' },
  linkedin: { size: 400, label: 'LinkedIn (400×400)' },
  facebook: { size: 320, label: 'Facebook (320×320)' },
  x: { size: 400, label: 'X / Twitter (400×400)' },
  youtube: { size: 800, label: 'YouTube (800×800)' },
  discord: { size: 512, label: 'Discord (512×512)' },
  custom: { size: 500, label: 'Custom (500×500)' },
};

export default function ProfilePicturePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [presets, setPresets] = useState<Record<string, ProfilePicPreset>>(DEFAULT_PRESETS);
  const [platform, setPlatform] = useState('instagram');
  const [customSize, setCustomSize] = useState(500);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [bgMode, setBgMode] = useState<'color' | 'blur'>('color');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProfilePicResult | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);

  useEffect(() => {
    getProfilePicPresets()
      .then(setPresets)
      .catch(() => setPresets(DEFAULT_PRESETS));
  }, []);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setResult(null);
    setProgress(0);
    setStatus('idle');
    setError('');
    setOffsetX(0);
    setOffsetY(0);
    setZoom(1.0);
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
      const res = await createProfilePicture(
        files[0],
        platform,
        customSize,
        offsetX,
        offsetY,
        zoom,
        bgMode,
        bgColor,
        (pct, phase) => {
          setProgress(pct);
          setStatus(phase === 'processing' ? 'processing' : 'uploading');
        },
      );
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Profile picture creation failed');
    }
  };

  const selectedPreset = presets[platform];
  const outputSize = platform === 'custom' ? customSize : selectedPreset?.size || 500;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Profile Picture Maker — Create Perfect Profile Photos"
        description="Create profile pictures sized perfectly for WhatsApp, Instagram, LinkedIn, Facebook, X, YouTube, and Discord. Free online tool."
        path="/profile-picture"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Picture Maker</h1>
        <p className="mt-2 text-gray-600">
          Create perfectly sized profile photos for any social platform.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop your photo here"
        description="Upload a photo for your profile picture (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Platform selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Choose Platform</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(presets).map(([key, preset]) => {
                const isActive = platform === key;
                const colorClass = isActive
                  ? PLATFORM_COLORS[key] || 'bg-violet-50 border-violet-500 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300';
                return (
                  <button
                    key={key}
                    onClick={() => setPlatform(key)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${colorClass}`}
                  >
                    <p className="font-semibold text-sm">{preset.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{preset.size}×{preset.size} px</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom size */}
          {platform === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Size (px)</label>
              <input
                type="number"
                min="64"
                max="2048"
                value={customSize}
                onChange={(e) => setCustomSize(Math.max(64, Math.min(2048, parseInt(e.target.value) || 64)))}
                className="w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              />
              <p className="text-xs text-gray-400 mt-1">Output: {customSize}×{customSize} px</p>
            </div>
          )}

          {/* Live circular preview */}
          {originalPreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Preview</label>
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div
                    className="w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-lg"
                    style={{ background: bgColor }}
                  >
                    <img
                      src={originalPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      style={{
                        transform: `scale(${zoom}) translate(${offsetX * 20}%, ${offsetY * 20}%)`,
                        transition: 'transform 0.15s ease-out',
                      }}
                    />
                  </div>
                  {/* Safe area guide */}
                  <div className="absolute inset-2 rounded-full border-2 border-dashed border-white/40 pointer-events-none" />
                  <p className="text-center text-xs text-gray-400 mt-2">
                    {outputSize}×{outputSize} — keep faces inside the dashed line
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Positioning controls */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Position & Zoom</label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Horizontal</label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={Math.round(offsetX * 100)}
                  onChange={(e) => setOffsetX(parseInt(e.target.value) / 100)}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>← Left</span>
                  <span>Right →</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vertical</label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={Math.round(offsetY * 100)}
                  onChange={(e) => setOffsetY(parseInt(e.target.value) / 100)}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>↑ Up</span>
                  <span>Down ↓</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Zoom: {zoom.toFixed(1)}×</label>
                <input
                  type="range"
                  min="100"
                  max="300"
                  value={Math.round(zoom * 100)}
                  onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Fit</span>
                  <span>Close-up</span>
                </div>
              </div>
            </div>
          </div>

          {/* Background mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Background Fill</label>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setBgMode('color')}
                className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  bgMode === 'color' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                Solid Color
              </button>
              <button
                onClick={() => setBgMode('blur')}
                className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  bgMode === 'blur' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                Blurred Fill
              </button>
              {bgMode === 'color' && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  />
                  <span className="text-sm text-gray-500">{bgColor}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {bgMode === 'blur'
                ? 'Fills empty areas with a blurred version of your image.'
                : 'Fills any empty areas with the selected color.'}
            </p>
          </div>

          {/* Progress & results */}
          <ProgressBar progress={progress} status={status} message={error} processingMessage="Creating profile picture…" />

          {result && status === 'done' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImagePreview src={originalPreview!} alt="Original" label="Original Photo" />
                <ImagePreview src={result.previewUrl} alt="Profile Picture" label={`${presets[platform]?.label || platform}`} />
              </div>
              <div className="p-5 bg-violet-50 border border-violet-200 rounded-xl animate-fade-in">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-violet-600" />
                  <span className="font-semibold text-violet-800">Profile picture ready!</span>
                </div>
                <p className="text-sm text-violet-600 mt-1">{outputSize}×{outputSize} px — optimized for {presets[platform]?.label || platform}.</p>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-500/25"
            >
              <User className="w-5 h-5" />
              Create Profile Picture
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-violet-700 font-semibold rounded-xl border-2 border-violet-200 hover:bg-violet-50 transition-colors"
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
