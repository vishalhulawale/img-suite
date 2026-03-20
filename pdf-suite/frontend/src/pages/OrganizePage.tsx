import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Download, RotateCw, Trash2, Copy, Plus, GripVertical, MoveUp, MoveDown,
  Undo2, Redo2, UploadCloud, AlertTriangle,
} from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import {
  getOrganizePreview, organizePDF, downloadBlob, checkPdfEncrypted,
  type OrganizePageInfo,
} from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

interface PageItem extends OrganizePageInfo {
  id: string;
  localRotation: number;
}

export default function OrganizePage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Touch/pointer-based drag for mobile (HTML5 DnD doesn't fire on touch)
  const touchDragIdxRef = useRef<number | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  // FLIP animation refs
  const gridRef = useRef<HTMLDivElement>(null);
  const preFlipPositions = useRef<Map<string, DOMRect>>(new Map());
  const pendingFlip = useRef(false);

  // Undo / Redo history
  const historyRef = useRef<PageItem[][]>([]);
  const historyIndexRef = useRef(-1);
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback((snapshot: PageItem[]) => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    // Truncate any forward history
    historyRef.current = history.slice(0, idx + 1);
    historyRef.current.push(snapshot.map((p) => ({ ...p })));
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  // Wrap setPages so every change is tracked in undo history
  const updatePages = useCallback((updater: PageItem[] | ((prev: PageItem[]) => PageItem[])) => {
    setPages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!skipHistoryRef.current) {
        pushHistory(next);
      }
      return next;
    });
    // Clear done/error status when pages change
    setStatus((s) => {
      if (s === 'done' || s === 'error') {
        // Also reset progress and error alongside status
        setProgress(0);
        setError('');
        return 'idle';
      }
      return s;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    skipHistoryRef.current = true;
    setPages(historyRef.current[idx - 1].map((p) => ({ ...p })));
    skipHistoryRef.current = false;
    // Clear done/error status on undo
    setStatus((s) => (s === 'done' || s === 'error' ? 'idle' : s));
    setProgress(0);
    setError('');
  }, []);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    historyIndexRef.current = idx + 1;
    skipHistoryRef.current = true;
    setPages(historyRef.current[idx + 1].map((p) => ({ ...p })));
    skipHistoryRef.current = false;
    // Clear done/error status on redo
    setStatus((s) => (s === 'done' || s === 'error' ? 'idle' : s));
    setProgress(0);
    setError('');
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const handleFileChange = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    setSourceFile(files[0]);
    setIsEncrypted(false);
    setLoading(true);
    setError('');
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
      const data = await getOrganizePreview(files[0], 72);
      const initialPages = data.pages.map((p, i) => ({
        ...p,
        id: `page-${i}-${Date.now()}`,
        localRotation: p.rotation,
      }));
      setPages(initialPages);
      // Initialize undo history
      historyRef.current = [initialPages.map((p) => ({ ...p }))];
      historyIndexRef.current = 0;
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === pages.length) setSelected(new Set());
    else setSelected(new Set(pages.map((p) => p.id)));
  };

  const rotatePage = (id: string, angle: number = 90) => {
    updatePages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, localRotation: (p.localRotation + angle) % 360 } : p,
      ),
    );
  };

  const rotateSelected = () => {
    updatePages((prev) =>
      prev.map((p) =>
        selected.has(p.id) ? { ...p, localRotation: (p.localRotation + 90) % 360 } : p,
      ),
    );
  };

  const deletePage = (id: string) => {
    updatePages((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const deleteSelected = () => {
    updatePages((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
  };

  const duplicatePage = (id: string) => {
    updatePages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const dup: PageItem = { ...src, id: `dup-${Date.now()}-${Math.random()}` };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  // ── FLIP animation helpers ──────────────────────────────────────
  // Snapshot every card's current DOM position before a reorder.
  const snapshotPositions = useCallback(() => {
    if (!gridRef.current) return;
    const map = new Map<string, DOMRect>();
    gridRef.current.querySelectorAll<HTMLElement>('[data-page-id]').forEach((el) => {
      map.set(el.dataset.pageId!, el.getBoundingClientRect());
    });
    preFlipPositions.current = map;
  }, []);

  // After React re-renders, animate each card from its old position to its new one.
  const playFlip = useCallback(() => {
    if (!gridRef.current) return;
    gridRef.current.querySelectorAll<HTMLElement>('[data-page-id]').forEach((el) => {
      if (el.dataset.dragging) return; // dragged card has opacity-50 ghost — skip
      const id = el.dataset.pageId!;
      const prev = preFlipPositions.current.get(id);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      // Invert: jump the element back to where it was
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.getBoundingClientRect(); // force reflow so the browser sees the jump
      // Play: release it and let CSS transition move it to natural position
      el.style.transition = 'transform 200ms ease';
      el.style.transform = '';
      el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
    });
  }, []);

  // Run FLIP synchronously after every render triggered by a drag reorder.
  useLayoutEffect(() => {
    if (!pendingFlip.current) return;
    pendingFlip.current = false;
    playFlip();
  });

  const movePage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= pages.length) return;
    snapshotPositions();
    pendingFlip.current = true;
    updatePages((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  };

  // Haptic feedback: Vibration API on Android, Web Animations scale pulse on iOS/others
  const haptic = (duration: number, el?: HTMLElement | null) => {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    } else if (el) {
      el.animate(
        [{ transform: 'scale(1.07)' }, { transform: 'scale(1)' }],
        { duration: 120, easing: 'ease-out' },
      );
    }
  };

  // Simple drag-and-drop with native HTML5 DnD
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      movePage(dragIdx, idx);
      setDragIdx(idx);
    }
  };
  const handleDragEnd = () => setDragIdx(null);

  // Touch drag handlers for mobile
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchDragCommittedRef = useRef(false);

  const handleTouchDragStart = (e: React.PointerEvent, idx: number) => {
    if (e.pointerType === 'mouse') return;
    // Don't preventDefault yet — let click/tap still work for selection.
    // We commit to drag only once the finger moves > threshold.
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    touchDragCommittedRef.current = false;
    touchDragIdxRef.current = idx;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!isTouchDragging) return;

    const onMove = (e: PointerEvent) => {
      const fromIdx = touchDragIdxRef.current;
      if (fromIdx === null) return;
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const card = (el as HTMLElement).closest('[data-page-idx]') as HTMLElement | null;
      if (!card) return;
      const toIdx = parseInt(card.dataset.pageIdx!, 10);
      if (!isNaN(toIdx) && toIdx !== fromIdx) {
        const draggedEl = document.querySelector(`[data-page-idx="${fromIdx}"]`) as HTMLElement | null;
        haptic(8, draggedEl);
        snapshotPositions();
        pendingFlip.current = true;
        setPages((prev) => {
          const next = [...prev];
          const [item] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, item);
          return next;
        });
        touchDragIdxRef.current = toIdx;
        setDragIdx(toIdx);
      }
    };

    const onEnd = () => {
      skipHistoryRef.current = false;
      setPages((prev) => {
        pushHistory(prev);
        return prev;
      });
      touchDragIdxRef.current = null;
      touchStartPosRef.current = null;
      touchDragCommittedRef.current = false;
      setDragIdx(null);
      setIsTouchDragging(false);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
    };
  }, [isTouchDragging, pushHistory, snapshotPositions]);

  // Pre-drag: detect movement threshold before committing to touch drag
  useEffect(() => {
    if (isTouchDragging) return; // already dragging, handled above

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      if (touchDragIdxRef.current === null || touchStartPosRef.current === null) return;
      if (touchDragCommittedRef.current) return;

      const dx = e.clientX - touchStartPosRef.current.x;
      const dy = e.clientY - touchStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        // Commit to drag
        touchDragCommittedRef.current = true;
        setDragIdx(touchDragIdxRef.current);
        setIsTouchDragging(true);
        skipHistoryRef.current = true;
        haptic(25);
      }
    };

    const onEnd = () => {
      if (!touchDragCommittedRef.current) {
        // Was a tap, not a drag — reset tracking
        touchDragIdxRef.current = null;
        touchStartPosRef.current = null;
      }
      touchDragCommittedRef.current = false;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
    };
  }, [isTouchDragging]);

  const handleApply = async () => {
    if (!sourceFile || pages.length === 0) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      // Build operations: reorder first, then rotations
      const operations: object[] = [];

      // Reorder: map current order back to original page numbers
      const order = pages.map((p) => p.page);
      operations.push({ type: 'reorder', order });

      // Rotations (applied after reorder, so use 1-based new positions)
      const rotations: { pages: number[]; angle: number } = { pages: [], angle: 0 };
      pages.forEach((p, i) => {
        const netRotation = (p.localRotation - p.rotation + 360) % 360;
        if (netRotation > 0) {
          // Group by rotation amount
          operations.push({ type: 'rotate', pages: [i + 1], angle: netRotation });
        }
      });

      const result = await organizePDF(
        sourceFile,
        operations,
        undefined,
        (pct) => {
          setProgress(pct);
          if (pct >= 100) setStatus('processing');
        },
      );

      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Failed to organize');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Organize PDF — Reorder, Rotate & Delete Pages Free"
        description="Organize PDF pages for free — drag to reorder, rotate, delete, or duplicate pages. Visual organizer, no sign-up needed."
        path="/organize"
      />
      <JsonLd data={toolSchema('Organize PDF — Free Online Tool', 'Reorder, rotate, delete, or duplicate PDF pages for free online.', 'https://smartpdfsuite.com/organize')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Organize PDF</h1>
        <p className="mt-2 text-gray-600">
          Drag to reorder, rotate, delete, or duplicate pages.
        </p>
      </div>

      {!sourceFile && !loading && (
        <FileDropzone
          files={[]}
          onFilesChange={handleFileChange}
          multiple={false}
          label="Drop a PDF to organize its pages"
          description="Upload a PDF to view and arrange pages"
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
                <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before organizing pages.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-gray-500">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-yellow-500 rounded-full animate-spin mx-auto mb-3" />
          Loading page thumbnails…
        </div>
      )}

      {/* Error state: preview failed to load */}
      {sourceFile && !loading && pages.length === 0 && historyRef.current.length === 0 && error && (
        <div className="text-center py-16">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setSourceFile(null);
              setError('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
          >
            <UploadCloud className="w-4 h-4" /> Try Again
          </button>
        </div>
      )}

      {/* Empty state: all pages removed (only show after pages were loaded at least once) */}
      {sourceFile && !loading && pages.length === 0 && historyRef.current.length > 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">All pages removed</h3>
          <p className="text-sm text-gray-500 mb-6">
            You've removed all pages. Upload a new PDF or undo your changes.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={undo}
              disabled={historyIndexRef.current <= 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 className="w-4 h-4" /> Undo
            </button>
            <button
              onClick={() => {
                setSourceFile(null);
                setPages([]);
                setSelected(new Set());
                setStatus('idle');
                setProgress(0);
                setError('');
                historyRef.current = [];
                historyIndexRef.current = -1;
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
            >
              <UploadCloud className="w-4 h-4" /> Upload New PDF
            </button>
          </div>
        </div>
      )}

      {pages.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <button
              onClick={undo}
              disabled={historyIndexRef.current <= 0}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndexRef.current >= historyRef.current.length - 1}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" /> Redo
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
              onClick={selectAll}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {selected.size === pages.length ? 'Deselect All' : 'Select All'}
            </button>
            {selected.size > 0 && (
              <>
                <button
                  onClick={rotateSelected}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-yellow-50 hover:text-yellow-700 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Rotate
                </button>
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete ({selected.size})
                </button>
              </>
            )}
            <span className="ml-auto text-xs text-gray-500">{pages.length} pages</span>
          </div>

          {/* Page grid */}
          <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                data-page-idx={idx}
                data-page-id={p.id}
                {...(dragIdx === idx ? { 'data-dragging': 'true' } : {})}
                draggable
                onDragStart={(e) => {
                  // Prevent browser text-selection ghost image on drag
                  e.dataTransfer.effectAllowed = 'move';
                  handleDragStart(idx);
                }}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={(e) => {
                  // Don't toggle selection if this pointer was used for dragging
                  if (isTouchDragging || touchDragCommittedRef.current) return;
                  toggleSelect(p.id);
                }}
                onPointerDown={(e) => {
                  // Ignore button clicks — let them handle themselves
                  if ((e.target as HTMLElement).closest('button')) return;
                  handleTouchDragStart(e, idx);
                }}
                className={`group relative rounded-xl border-2 overflow-hidden cursor-grab transition-all select-none ${
                  selected.has(p.id)
                    ? 'border-yellow-500 ring-2 ring-yellow-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${dragIdx === idx ? 'opacity-50' : ''}`}
                style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {/* Thumbnail */}
                <div className="relative bg-gray-100 flex items-center justify-center p-2 aspect-[3/4]">
                  <img
                    src={p.thumbnail}
                    alt={`Page ${p.page}`}
                    className="max-w-full max-h-full object-contain"
                    style={{ transform: `rotate(${p.localRotation}deg)` }}
                    draggable={false}
                  />
                  {/* Drag handle indicator */}
                  <div className="absolute top-1 left-1">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </div>
                  {/* Page number badge */}
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </div>
                  {/* Selection checkbox */}
                  <div className={`absolute top-1 right-1 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                    selected.has(p.id) ? 'bg-yellow-500 border-yellow-500' : 'border-gray-300 bg-white'
                  }`}>
                    {selected.has(p.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Actions bar */}
                <div className="flex items-center justify-center gap-1 p-1.5 bg-white border-t border-gray-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); movePage(idx, idx - 1); }}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <MoveUp className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); movePage(idx, idx + 1); }}
                    disabled={idx === pages.length - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <MoveDown className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); rotatePage(p.id); }}
                    className="p-1 rounded hover:bg-yellow-50 transition-colors"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-yellow-600" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); duplicatePage(p.id); }}
                    className="p-1 rounded hover:bg-green-50 transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5 text-green-600" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}
                    className="p-1 rounded hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Organizing PDF — this may take a moment…" />
          </div>

          <div className="mt-6">
            <button
              onClick={handleApply}
              disabled={pages.length === 0 || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-yellow-500/25"
            >
              <Download className="w-5 h-5" />
              Apply & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
