import { useState, useRef, useCallback } from 'react';
import {
  Download, Search, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle,
} from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import {
  getRedactPreview, searchRedactKeyword, applyRedactions,
  downloadBlob, checkPdfEncrypted, type RedactArea, type PagePreview,
} from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

export default function RedactPage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [redactions, setRedactions] = useState<RedactArea[]>([]);
  const [keyword, setKeyword] = useState('');
  const [fillColor, setFillColor] = useState('#000000');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showRedactions, setShowRedactions] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleFileChange = useCallback(async (files: File[]) => {
    if (!files[0]) {
      setSourceFile(null);
      setPages([]);
      setRedactions([]);
      setCurrentPage(0);
      setStatus('idle');
      setProgress(0);
      setError('');
      setIsEncrypted(false);
      return;
    }
    setSourceFile(files[0]);
    setIsEncrypted(false);
    setLoading(true);
    setError('');
    setRedactions([]);
    setStatus('idle');
    setProgress(0);
    try {
      const encrypted = await checkPdfEncrypted(files[0]);
      if (encrypted) {
        setIsEncrypted(true);
        setLoading(false);
        return;
      }
    } catch { /* ignore check failure */ }
    try {
      const data = await getRedactPreview(files[0], 100);
      setPages(data.pages);
      setCurrentPage(0);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!sourceFile || !keyword.trim()) return;
    setSearching(true);
    if (status === 'done') { setStatus('idle'); setProgress(0); }
    try {
      const data = await searchRedactKeyword(sourceFile, keyword);
      if (data.count === 0) {
        setError(`No matches found for "${keyword}"`);
        return;
      }
      setRedactions((prev) => [...prev, ...data.matches]);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Convert mouse/touch position to PDF coordinates
  const toPdfCoords = (clientX: number, clientY: number) => {
    if (!imgRef.current || !pages[currentPage]) return null;
    const imgRect = imgRef.current.getBoundingClientRect();
    const page = pages[currentPage];
    const scaleX = page.width / imgRect.width;
    const scaleY = page.height / imgRect.height;
    return {
      x: (clientX - imgRect.left) * scaleX,
      y: (clientY - imgRect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const coords = toPdfCoords(e.clientX, e.clientY);
    if (!coords) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = toPdfCoords(e.clientX, e.clientY);
    if (coords) setDrawCurrent(coords);
  };

  const handlePointerUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      return;
    }

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    // Minimum size to avoid accidental clicks
    if (width > 5 && height > 5) {
      setRedactions((prev) => [
        ...prev,
        { page: currentPage + 1, x, y, width, height },
      ]);
      if (status === 'done') { setStatus('idle'); setProgress(0); }
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const removeRedaction = (index: number) => {
    setRedactions((prev) => prev.filter((_, i) => i !== index));
    if (status === 'done') { setStatus('idle'); setProgress(0); }
  };

  const clearPageRedactions = () => {
    setRedactions((prev) => prev.filter((r) => r.page !== currentPage + 1));
    if (status === 'done') { setStatus('idle'); setProgress(0); }
  };

  const handleApply = async () => {
    if (!sourceFile || redactions.length === 0) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      const result = await applyRedactions(
        sourceFile,
        redactions,
        fillColor,
        (pct) => {
          setProgress(pct);
          if (pct >= 100) setStatus('processing');
        },
      );
      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Redaction failed');
    }
  };

  const currentPageRedactions = redactions.filter((r) => r.page === currentPage + 1);
  const page = pages[currentPage];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Redact PDF — Permanently Mask Sensitive Content Free"
        description="Redact PDF for free — permanently mask sensitive content by drawing redaction boxes or searching for keywords. No sign-up needed."
        path="/redact"
      />
      <JsonLd data={toolSchema('Redact PDF — Free Online Tool', 'Permanently mask sensitive PDF content by drawing redaction boxes or searching keywords. Free online.', 'https://smartpdfsuite.com/redact')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Redact PDF</h1>
        <p className="mt-2 text-gray-600">
          Permanently mask sensitive content by drawing redaction boxes or searching for keywords.
        </p>
      </div>

      {!sourceFile && (
        <FileDropzone
          files={[]}
          onFilesChange={handleFileChange}
          multiple={false}
          label="Drop a PDF to redact"
          description="Upload a PDF to start masking sensitive content"
        />
      )}

      {sourceFile && isEncrypted && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 truncate">{sourceFile.name}</p>
            <button
              onClick={() => { setSourceFile(null); setIsEncrypted(false); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Change file
            </button>
          </div>
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">This PDF is password-protected</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Please remove the password protection first using the{' '}
                <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before redacting.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-gray-500">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
          Loading preview…
        </div>
      )}

      {page && (
        <div className="space-y-6">
          {/* File info & change file */}
          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
            <p className="text-sm font-medium text-gray-700 truncate">{sourceFile?.name}</p>
            <button
              onClick={() => {
                setSourceFile(null);
                setPages([]);
                setRedactions([]);
                setCurrentPage(0);
                setStatus('idle');
                setProgress(0);
                setError('');
              }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change file
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            {/* Keyword search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search keyword to redact…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !keyword.trim()}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                {searching ? '…' : 'Find'}
              </button>
            </div>

            {/* Fill color */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Color:</label>
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-300"
              />
            </div>

            {/* Toggle visibility */}
            <button
              onClick={() => setShowRedactions(!showRedactions)}
              className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {showRedactions ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showRedactions ? 'Hide' : 'Show'}
            </button>

            {/* Clear page redactions */}
            {currentPageRedactions.length > 0 && (
              <button
                onClick={clearPageRedactions}
                className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Page
              </button>
            )}

            <span className="ml-auto text-xs text-gray-500">
              {redactions.length} redaction{redactions.length !== 1 ? 's' : ''} total
            </span>
          </div>

          {/* Page navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Page {currentPage + 1} of {pages.length}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
              disabled={currentPage === pages.length - 1}
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas area */}
          <div className="flex justify-center">
            <div
              ref={canvasRef}
              className="relative border border-gray-300 rounded-xl overflow-hidden shadow-lg cursor-crosshair select-none"
              style={{ maxWidth: '100%', width: 'fit-content', touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => { if (isDrawing) handlePointerUp(); }}
            >
              <img
                ref={imgRef}
                src={page.image}
                alt={`Page ${currentPage + 1}`}
                className="block max-w-full"
                draggable={false}
              />

              {/* Redaction overlays */}
              {showRedactions && currentPageRedactions.map((r, idx) => {
                const img = imgRef.current;
                if (!img) return null;
                const scaleX = img.clientWidth / page.width;
                const scaleY = img.clientHeight / page.height;
                return (
                  <div
                    key={idx}
                    className="absolute"
                    style={{
                      left: r.x * scaleX,
                      top: r.y * scaleY,
                      width: r.width * scaleX,
                      height: r.height * scaleY,
                      backgroundColor: fillColor + 'CC',
                      border: '2px solid ' + fillColor,
                    }}
                  >
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const globalIdx = redactions.findIndex(
                          (rd) => rd.page === r.page && rd.x === r.x && rd.y === r.y && rd.width === r.width && rd.height === r.height,
                        );
                        if (globalIdx !== -1) removeRedaction(globalIdx);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center shadow-md"
                      style={{ touchAction: 'none' }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {/* Drawing preview */}
              {isDrawing && drawStart && drawCurrent && imgRef.current && (
                <div
                  className="absolute border-2 border-dashed pointer-events-none"
                  style={{
                    borderColor: fillColor,
                    backgroundColor: fillColor + '33',
                    left: Math.min(drawStart.x, drawCurrent.x) * (imgRef.current.clientWidth / page.width),
                    top: Math.min(drawStart.y, drawCurrent.y) * (imgRef.current.clientHeight / page.height),
                    width: Math.abs(drawCurrent.x - drawStart.x) * (imgRef.current.clientWidth / page.width),
                    height: Math.abs(drawCurrent.y - drawStart.y) * (imgRef.current.clientHeight / page.height),
                  }}
                />
              )}
            </div>
          </div>

          <div className="text-center text-xs text-gray-500">
            Click and drag on the page to draw a redaction area. Use keyword search for text-based redaction.
          </div>

          <div className="mt-4">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Redacting PDF — this may take a moment…" />
          </div>

          <div className="mt-6">
            <button
              onClick={handleApply}
              disabled={redactions.length === 0 || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-500/25"
            >
              <Download className="w-5 h-5" />
              Redact & Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
