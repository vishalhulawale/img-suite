import { useState, useCallback } from 'react';
import { Download, Type, Plus, Trash2 } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import ImagePreview from '../components/ImagePreview';
import { applyTextOverlay, downloadBlob, TextLayer, TextOverlayResult } from '../api';
import SEOHead from '../components/SEOHead';

const QUICK_STYLES = [
  {
    label: 'Quote Card',
    config: { font_size: 36, bold: true, color: '#FFFFFF', shadow: true, outline: false, bg_box: false, bg_box_color: '#000000', bg_box_opacity: 0.5, align: 'center' as const },
  },
  {
    label: 'Title Banner',
    config: { font_size: 48, bold: true, color: '#FFFFFF', shadow: false, outline: true, bg_box: false, bg_box_color: '#000000', bg_box_opacity: 0.5, align: 'center' as const },
  },
  {
    label: 'Subtle Label',
    config: { font_size: 20, bold: false, color: '#FFFFFF', shadow: true, outline: false, bg_box: true, bg_box_color: '#000000', bg_box_opacity: 0.5, align: 'center' as const },
  },
  {
    label: 'Bold Badge',
    config: { font_size: 28, bold: true, color: '#FFFFFF', shadow: false, outline: false, bg_box: true, bg_box_color: '#EF4444', bg_box_opacity: 0.9, align: 'center' as const },
  },
];

interface LayerState extends Omit<TextLayer, 'opacity'> {
  opacity: number;
  id: number;
}

let nextId = 1;

function createDefaultLayer(): LayerState {
  return {
    id: nextId++,
    text: 'Your text here',
    x: 50,
    y: 50,
    font_size: 32,
    bold: false,
    color: '#FFFFFF',
    opacity: 1.0,
    align: 'center',
    shadow: true,
    outline: false,
    bg_box: false,
    bg_box_color: '#000000',
    bg_box_opacity: 0.5,
  };
}

export default function TextOnImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [layers, setLayers] = useState<LayerState[]>([createDefaultLayer()]);
  const [activeLayer, setActiveLayer] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<TextOverlayResult | null>(null);
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

  const updateLayer = (index: number, updates: Partial<LayerState>) => {
    setLayers((prev) => prev.map((l, i) => (i === index ? { ...l, ...updates } : l)));
  };

  const addLayer = () => {
    if (layers.length >= 10) return;
    setLayers((prev) => [...prev, createDefaultLayer()]);
    setActiveLayer(layers.length);
  };

  const removeLayer = (index: number) => {
    if (layers.length <= 1) return;
    setLayers((prev) => prev.filter((_, i) => i !== index));
    if (activeLayer >= layers.length - 1) setActiveLayer(Math.max(0, layers.length - 2));
  };

  const applyQuickStyle = (styleConfig: typeof QUICK_STYLES[number]['config']) => {
    updateLayer(activeLayer, styleConfig);
  };

  const handleApply = async () => {
    if (!files[0]) return;
    setStatus('uploading');
    setProgress(0);
    setError('');
    setResult(null);

    try {
      const apiLayers: TextLayer[] = layers.map((l) => ({
        text: l.text,
        x: l.x,
        y: l.y,
        font_size: l.font_size,
        bold: l.bold,
        color: l.color,
        opacity: l.opacity,
        align: l.align,
        shadow: l.shadow,
        outline: l.outline,
        bg_box: l.bg_box,
        bg_box_color: l.bg_box_color,
        bg_box_opacity: l.bg_box_opacity,
      }));

      const res = await applyTextOverlay(files[0], apiLayers, (pct, phase) => {
        setProgress(pct);
        setStatus(phase === 'processing' ? 'processing' : 'uploading');
      });
      setStatus('done');
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Text overlay failed');
    }
  };

  const current = layers[activeLayer];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Text on Image — Add Text to Photos Online Free"
        description="Add text to images for free — create social graphics, quotes, thumbnails, and announcements. Multiple styles, shadows, outlines."
        path="/text-on-image"
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Text on Image</h1>
        <p className="mt-2 text-gray-600">
          Add styled text to your images — create quote cards, thumbnails, captions, and more.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={false}
        label="Drop a background image here"
        description="Upload an image to add text to (PNG, JPG, WebP)"
      />

      {files.length > 0 && (
        <div className="mt-8 space-y-6 animate-fade-in">
          {/* Quick styles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Quick Styles</label>
            <div className="flex flex-wrap gap-2">
              {QUICK_STYLES.map((style) => (
                <button
                  key={style.label}
                  onClick={() => applyQuickStyle(style.config)}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-sky-400 hover:text-sky-700 transition-all"
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layer tabs */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium text-gray-700">Text Layers</label>
              <button
                onClick={addLayer}
                disabled={layers.length >= 10}
                className="p-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {layers.map((layer, i) => (
                <div key={layer.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveLayer(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeLayer === i
                        ? 'bg-sky-100 text-sky-700 border-2 border-sky-400'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300'
                    }`}
                  >
                    {layer.text.slice(0, 15) || `Layer ${i + 1}`}
                  </button>
                  {layers.length > 1 && (
                    <button
                      onClick={() => removeLayer(i)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active layer editor */}
          {current && (
            <div className="space-y-4 p-4 bg-white border border-gray-200 rounded-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Text</label>
                <input
                  type="text"
                  value={current.text}
                  onChange={(e) => updateLayer(activeLayer, { text: e.target.value })}
                  maxLength={200}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="Enter your text…"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Font Size: {current.font_size}px</label>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={current.font_size}
                    onChange={(e) => updateLayer(activeLayer, { font_size: parseInt(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">X Position: {current.x}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={current.x}
                    onChange={(e) => updateLayer(activeLayer, { x: parseInt(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Y Position: {current.y}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={current.y}
                    onChange={(e) => updateLayer(activeLayer, { y: parseInt(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Opacity: {Math.round(current.opacity * 100)}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round(current.opacity * 100)}
                    onChange={(e) => updateLayer(activeLayer, { opacity: parseInt(e.target.value) / 100 })}
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Color</label>
                  <input
                    type="color"
                    value={current.color}
                    onChange={(e) => updateLayer(activeLayer, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Align</label>
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => updateLayer(activeLayer, { align: a })}
                      className={`px-2 py-1 text-xs rounded-lg border ${
                        current.align === a ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500'
                      }`}
                    >
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.bold}
                    onChange={(e) => updateLayer(activeLayer, { bold: e.target.checked })}
                    className="rounded accent-sky-500"
                  />
                  <span className="text-sm text-gray-700">Bold</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.shadow}
                    onChange={(e) => updateLayer(activeLayer, { shadow: e.target.checked })}
                    className="rounded accent-sky-500"
                  />
                  <span className="text-sm text-gray-700">Shadow</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.outline}
                    onChange={(e) => updateLayer(activeLayer, { outline: e.target.checked })}
                    className="rounded accent-sky-500"
                  />
                  <span className="text-sm text-gray-700">Outline</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.bg_box}
                    onChange={(e) => updateLayer(activeLayer, { bg_box: e.target.checked })}
                    className="rounded accent-sky-500"
                  />
                  <span className="text-sm text-gray-700">Background Box</span>
                </label>
              </div>

              {current.bg_box && (
                <div className="flex items-center gap-4 pl-4 border-l-2 border-sky-200">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Box Color</label>
                    <input
                      type="color"
                      value={current.bg_box_color}
                      onChange={(e) => updateLayer(activeLayer, { bg_box_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Box Opacity: {Math.round(current.bg_box_opacity * 100)}%</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={Math.round(current.bg_box_opacity * 100)}
                      onChange={(e) => updateLayer(activeLayer, { bg_box_opacity: parseInt(e.target.value) / 100 })}
                      className="w-full accent-sky-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress, preview, actions */}
          <ProgressBar progress={progress} status={status} message={error} processingMessage="Rendering text…" />

          {(originalPreview || result) && status !== 'uploading' && status !== 'processing' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {originalPreview && (
                <ImagePreview src={originalPreview} alt="Original" label="Original" />
              )}
              {result && (
                <ImagePreview src={result.previewUrl} alt="With Text" label="With Text" />
              )}
            </div>
          )}

          {result && status === 'done' && (
            <div className="p-5 bg-sky-50 border border-sky-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <Type className="w-5 h-5 text-sky-600" />
                <span className="font-semibold text-sky-800">Text applied successfully!</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleApply}
              disabled={!files[0] || status === 'uploading' || status === 'processing'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-600 text-white font-semibold rounded-xl hover:bg-sky-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-sky-500/25"
            >
              <Type className="w-5 h-5" />
              Apply Text
            </button>
            {result && (
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
                className="px-6 py-3.5 bg-white text-sky-700 font-semibold rounded-xl border-2 border-sky-200 hover:bg-sky-50 transition-colors"
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
