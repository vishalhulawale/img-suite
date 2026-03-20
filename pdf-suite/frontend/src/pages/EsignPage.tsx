import { useState, useRef, useCallback, useEffect } from 'react';
import { Download, PenTool, Image, Type, Trash2, Plus, X, AlertTriangle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import { esignPDF, getEsignPreview, downloadBlob, SignaturePlacement, PagePreview, checkPdfEncrypted } from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

type SigMode = 'draw' | 'image' | 'text';

interface Signature {
  id: string;
  type: SigMode;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: string;        // base64 for draw, text for text mode
  imageFile?: File;
  imageIndex?: number;
  fontSize?: number;
  color?: string;
}

export default function EsignPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<PagePreview[] | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [activeMode, setActiveMode] = useState<SigMode>('draw');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [sigText, setSigText] = useState('');
  const [sigImages, setSigImages] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);

  const [draggingSig, setDraggingSig] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const justDraggedRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Load preview when file is uploaded
  const handleFilesChange = async (newFiles: File[]) => {
    setFiles(newFiles);
    setSignatures([]);
    setPreview(null);
    setStatus('idle');
    setProgress(0);
    setError('');
    setIsEncrypted(false);
    if (newFiles[0]) {
      try {
        const encrypted = await checkPdfEncrypted(newFiles[0]);
        if (encrypted) {
          setIsEncrypted(true);
          return;
        }
      } catch { /* ignore check failure */ }
      setLoadingPreview(true);
      try {
        const data = await getEsignPreview(newFiles[0]);
        setPreview(data.pages);
        setCurrentPage(1);
      } catch {
        setError('Failed to load PDF preview.');
      }
      setLoadingPreview(false);
    }
  };

  // Drawing handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Add signature from canvas
  const addDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');

    const sig: Signature = {
      id: `sig-${Date.now()}`,
      type: 'draw',
      page: currentPage,
      x: 100,
      y: 400,
      width: 200,
      height: 60,
      data,
    };
    setSignatures([...signatures, sig]);
    clearCanvas();
  };

  // Add text signature
  const addTextSignature = () => {
    if (!sigText.trim()) return;
    const sig: Signature = {
      id: `sig-${Date.now()}`,
      type: 'text',
      page: currentPage,
      x: 100,
      y: 400,
      width: 200,
      height: 40,
      data: sigText,
      fontSize: 24,
      color: '#000000',
    };
    setSignatures([...signatures, sig]);
    setSigText('');
  };

  // Add image signature
  const addImageSignature = () => {
    if (!sigImages[0]) return;
    const sig: Signature = {
      id: `sig-${Date.now()}`,
      type: 'image',
      page: currentPage,
      x: 100,
      y: 400,
      width: 200,
      height: 60,
      data: '',
      imageFile: sigImages[0],
      imageIndex: 0,
    };
    setSignatures([...signatures, sig]);
  };

  const removeSignature = (id: string) => {
    setSignatures(signatures.filter((s) => s.id !== id));
    if (status === 'done') { setStatus('idle'); setProgress(0); }
  };

  // Handle clicking on preview to place signature
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (draggingSig) return; // don't reposition while dragging
    // After a drag ends, the browser fires a click event — ignore it
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (signatures.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update last signature position
    const page = preview?.find((p) => p.page === pageNum);
    if (!page) return;

    // Scale coordinates from display to PDF coordinates
    const scaleX = page.width / rect.width;
    const scaleY = page.height / rect.height;

    setSignatures((prev) => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.page = pageNum;
      last.x = x * scaleX;
      last.y = y * scaleY;
      updated[updated.length - 1] = last;
      return updated;
    });
    if (status === 'done') { setStatus('idle'); setProgress(0); }
  };

  // Drag handlers for moving signatures on preview
  const handleSigDragStart = (e: React.PointerEvent, sigId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const container = pageContainerRef.current;
    const pageData = preview?.[currentPage - 1];
    if (!container || !pageData) return;

    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;
    const scaleX = displayWidth / pageData.width;
    const scaleY = displayHeight / pageData.height;

    const sig = signatures.find((s) => s.id === sigId);
    if (!sig) return;

    const rect = container.getBoundingClientRect();
    setDraggingSig(sigId);
    dragOffsetRef.current = {
      x: e.clientX - rect.left - sig.x * scaleX,
      y: e.clientY - rect.top - sig.y * scaleY,
    };
  };

  const handleSigDragMove = useCallback((e: PointerEvent) => {
    if (!draggingSig) return;
    const container = pageContainerRef.current;
    const pageData = preview?.[currentPage - 1];
    if (!container || !pageData) return;

    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;
    const scaleX = displayWidth / pageData.width;
    const scaleY = displayHeight / pageData.height;

    const rect = container.getBoundingClientRect();
    let newDisplayX = e.clientX - rect.left - dragOffsetRef.current.x;
    let newDisplayY = e.clientY - rect.top - dragOffsetRef.current.y;

    // Clamp to container bounds
    setSignatures((prev) => {
      const sig = prev.find((s) => s.id === draggingSig);
      if (!sig) return prev;
      const sigWidth = sig.width * scaleX;
      const sigHeight = sig.height * scaleY;
      newDisplayX = Math.max(0, Math.min(newDisplayX, displayWidth - sigWidth));
      newDisplayY = Math.max(0, Math.min(newDisplayY, displayHeight - sigHeight));

      return prev.map((s) =>
        s.id === draggingSig
          ? { ...s, x: newDisplayX / scaleX, y: newDisplayY / scaleY }
          : s,
      );
    });
  }, [draggingSig, preview, currentPage]);

  const handleSigDragEnd = useCallback(() => {
    if (draggingSig) {
      justDraggedRef.current = true;
    }
    setDraggingSig(null);
  }, [draggingSig]);

  useEffect(() => {
    if (draggingSig) {
      window.addEventListener('pointermove', handleSigDragMove);
      window.addEventListener('pointerup', handleSigDragEnd);
      return () => {
        window.removeEventListener('pointermove', handleSigDragMove);
        window.removeEventListener('pointerup', handleSigDragEnd);
      };
    }
  }, [draggingSig, handleSigDragMove, handleSigDragEnd]);

  const handleSign = async () => {
    if (!files[0] || signatures.length === 0) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      // Collect all image files
      const imageFiles: File[] = [];
      const placements: SignaturePlacement[] = signatures.map((sig) => {
        const placement: SignaturePlacement = {
          type: sig.type,
          page: sig.page,
          x: sig.x,
          y: sig.y,
          width: sig.width,
          height: sig.height,
        };

        if (sig.type === 'draw') {
          placement.data = sig.data;
        } else if (sig.type === 'text') {
          placement.data = sig.data;
          placement.fontSize = sig.fontSize;
          placement.color = sig.color;
        } else if (sig.type === 'image' && sig.imageFile) {
          placement.imageIndex = imageFiles.length;
          imageFiles.push(sig.imageFile);
        }

        return placement;
      });

      const result = await esignPDF(
        files[0],
        placements,
        imageFiles.length > 0 ? imageFiles : undefined,
        (pct) => {
          setProgress(pct);
          if (pct >= 100) setStatus('processing');
        },
      );
      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Signing failed');
    }
  };

  const modes = [
    { value: 'draw' as SigMode, label: 'Draw', icon: PenTool },
    { value: 'image' as SigMode, label: 'Image', icon: Image },
    { value: 'text' as SigMode, label: 'Type', icon: Type },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="eSign PDF — Add Electronic Signatures Free"
        description="eSign PDF for free — draw, type, or upload your signature and place it on any PDF. Free online signing tool, no sign-up needed."
        path="/esign"
      />
      <JsonLd data={toolSchema('eSign PDF — Free Online Tool', 'Draw, type, or upload your signature and place it on any PDF for free.', 'https://smartpdfsuite.com/esign')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">eSign PDF</h1>
        <p className="mt-2 text-gray-600">
          Draw, type, or upload your signature and place it on your PDF.
        </p>
      </div>

      {!files[0] && (
        <FileDropzone
          files={files}
          onFilesChange={handleFilesChange}
          multiple={false}
          label="Drop a PDF file here"
          description="Upload a PDF to sign"
        />
      )}

      {files[0] && isEncrypted && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 truncate">{files[0].name}</p>
            <button
              onClick={() => { setFiles([]); setIsEncrypted(false); }}
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
                <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before signing.
              </p>
            </div>
          </div>
        </div>
      )}

      {files[0] && !isEncrypted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Signature tools */}
          <div className="lg:col-span-1 space-y-6">
            {/* File info */}
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <p className="text-sm font-medium text-gray-700 truncate">{files[0].name}</p>
              <button
                onClick={() => {
                  setFiles([]);
                  setPreview(null);
                  setSignatures([]);
                  setStatus('idle');
                  setProgress(0);
                  setError('');
                }}
                className="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                Change file
              </button>
            </div>

            {/* Signature mode tabs */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200">
                {modes.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setActiveMode(m.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                        activeMode === m.value
                          ? 'text-pink-600 bg-pink-50 border-b-2 border-pink-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-4">
                {activeMode === 'draw' && (
                  <div className="space-y-3">
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={100}
                      className="sig-canvas w-full bg-white touch-none"
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerLeave={stopDrawing}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={clearCanvas}
                        className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={addDrawnSignature}
                        className="flex-1 py-2 text-sm text-white bg-pink-500 rounded-lg hover:bg-pink-600 transition-colors"
                      >
                        Add Signature
                      </button>
                    </div>
                  </div>
                )}

                {activeMode === 'text' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={sigText}
                      onChange={(e) => setSigText(e.target.value)}
                      placeholder="Type your signature..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl font-serif text-2xl italic focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={addTextSignature}
                      disabled={!sigText.trim()}
                      className="w-full py-2 text-sm text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:bg-gray-300 transition-colors"
                    >
                      Add Text Signature
                    </button>
                  </div>
                )}

                {activeMode === 'image' && (
                  <div className="space-y-3">
                    <FileDropzone
                      files={sigImages}
                      onFilesChange={setSigImages}
                      accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
                      multiple={false}
                      label="Drop signature image"
                      description="PNG or JPG"
                    />
                    <button
                      onClick={addImageSignature}
                      disabled={!sigImages[0]}
                      className="w-full py-2 text-sm text-white bg-pink-500 rounded-lg hover:bg-pink-600 disabled:bg-gray-300 transition-colors"
                    >
                      Add Image Signature
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Placed signatures list */}
            {signatures.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Placed Signatures ({signatures.length})
                </h3>
                <div className="space-y-2">
                  {signatures.map((sig) => (
                    <div
                      key={sig.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 capitalize">{sig.type}</span>
                        <span className="text-gray-400 ml-2">Page {sig.page}</span>
                      </div>
                      <button
                        onClick={() => removeSignature(sig.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sign button */}
            <div>
              <ProgressBar progress={progress} status={status} message={error} processingMessage="Signing PDF — this may take a moment…" />
              <button
                onClick={handleSign}
                disabled={signatures.length === 0 || status === 'uploading' || status === 'processing'}
                className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3.5 bg-pink-500 text-white font-semibold rounded-xl hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-pink-500/25"
              >
                <Download className="w-5 h-5" />
                Sign & Download
              </button>
            </div>
          </div>

          {/* Right: PDF Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">PDF Preview</h3>
                {preview && preview.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      ←
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} / {preview.length}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(preview.length, currentPage + 1))}
                      disabled={currentPage >= preview.length}
                      className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>

              {loadingPreview && (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
                </div>
              )}

              {preview && preview[currentPage - 1] && (
                <div
                  ref={pageContainerRef}
                  className="relative cursor-crosshair border border-gray-200 rounded-lg overflow-hidden"
                  onClick={(e) => handlePreviewClick(e, currentPage)}
                >
                  <img
                    src={preview[currentPage - 1].image}
                    alt={`Page ${currentPage}`}
                    className="w-full"
                  />
                  {/* Show placed signatures on this page */}
                  {signatures
                    .filter((s) => s.page === currentPage)
                    .map((sig) => {
                      const page = preview[currentPage - 1];
                      const container = pageContainerRef.current;
                      if (!container) return null;
                      const displayWidth = container.clientWidth;
                      const displayHeight = container.clientHeight;
                      const scaleX = displayWidth / page.width;
                      const scaleY = displayHeight / page.height;

                      return (
                        <div
                          key={sig.id}
                          className="absolute border-2 border-pink-400 bg-pink-50/30 rounded cursor-move group"
                          style={{
                            left: sig.x * scaleX,
                            top: sig.y * scaleY,
                            width: sig.width * scaleX,
                            height: sig.height * scaleY,
                            overflow: 'hidden',
                            touchAction: 'none',
                          }}
                          onPointerDown={(e) => handleSigDragStart(e, sig.id)}
                        >
                          {/* Signature content */}
                          {sig.type === 'draw' && (
                            <img
                              src={sig.data}
                              alt="Drawn signature"
                              className="w-full h-full object-contain pointer-events-none"
                              draggable={false}
                            />
                          )}
                          {sig.type === 'text' && (
                            <span
                              className="flex items-center justify-center w-full h-full font-serif italic pointer-events-none select-none"
                              style={{
                                fontSize: Math.max(10, (sig.fontSize || 24) * scaleY * 0.6),
                                color: sig.color || '#000',
                              }}
                            >
                              {sig.data}
                            </span>
                          )}
                          {sig.type === 'image' && sig.imageFile && (
                            <img
                              src={URL.createObjectURL(sig.imageFile)}
                              alt="Image signature"
                              className="w-full h-full object-contain pointer-events-none"
                              draggable={false}
                            />
                          )}
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSignature(sig.id);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity z-10 border border-white shadow"
                            style={{ zIndex: 20 }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <span className="text-xs bg-pink-500 text-white px-1 rounded absolute -top-4 left-0 pointer-events-none">
                            {sig.type}
                          </span>
                        </div>
                      );
                    })}
                  <p className="text-center text-xs text-gray-400 py-2">
                    Click to position the last added signature
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
