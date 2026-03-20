import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Download, AlertTriangle } from 'lucide-react';
import FileDropzone from '../components/FileDropzone';
import ProgressBar from '../components/ProgressBar';
import { mergePDFs, downloadBlob, checkPdfEncrypted } from '../api';
import SEOHead from '../components/SEOHead';
import JsonLd, { toolSchema } from '../components/JsonLd';

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [hasEncryptedFile, setHasEncryptedFile] = useState(false);

  // Reset completed/error status when files change
  const handleFilesChange = useCallback(async (newFiles: File[]) => {
    setFiles(newFiles);
    if (status === 'done' || status === 'error') {
      setStatus('idle');
      setProgress(0);
      setError('');
    }
    setHasEncryptedFile(false);
    if (newFiles.length > 0) {
      try {
        const checks = await Promise.all(newFiles.map((f) => checkPdfEncrypted(f)));
        setHasEncryptedFile(checks.some(Boolean));
      } catch { /* ignore check failure */ }
    }
  }, [status]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const items = Array.from(files);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, moved);
      setFiles(items);
      if (status === 'done' || status === 'error') {
        setStatus('idle');
        setProgress(0);
        setError('');
      }
    },
    [files, status],
  );

  const handleMerge = async () => {
    if (files.length < 2) return;
    setStatus('uploading');
    setProgress(0);
    setError('');

    try {
      const result = await mergePDFs(files, (pct) => {
        setProgress(pct);
        if (pct >= 100) setStatus('processing');
      });
      setStatus('done');
      downloadBlob(result.blob, result.filename);
    } catch (err: any) {
      setStatus('error');
      setError(err?.response?.data?.detail || err.message || 'Merge failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <SEOHead
        title="Merge PDF — Combine PDF Files Online Free"
        description="Merge PDF files online for free — combine multiple PDFs into one document. Drag to reorder pages. No sign-up, no install."
        path="/merge"
      />
      <JsonLd data={toolSchema('Merge PDF — Free Online Tool', 'Combine multiple PDF files into a single document for free. No sign-up required.', 'https://smartpdfsuite.com/merge')} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Merge PDF</h1>
        <p className="mt-2 text-gray-600">
          Combine multiple PDF files into a single document. Drag to reorder.
        </p>
      </div>

      <FileDropzone
        files={files}
        onFilesChange={handleFilesChange}
        multiple={true}
        maxFiles={20}
        label="Drop PDF files here"
        description="Upload 2 or more PDFs to merge"
      />

      {files.length > 0 && hasEncryptedFile && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">One or more PDFs are password-protected</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please remove the password protection first using the{' '}
              <a href="/unlock" className="underline font-medium">Unlock PDF</a> tool before merging.
            </p>
          </div>
        </div>
      )}

      {/* Draggable order list */}
      {files.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Drag to reorder ({files.length} files)
          </h3>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="merge-list">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {files.map((file, index) => (
                    <Draggable key={`${file.name}-${index}`} draggableId={`${file.name}-${index}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`flex items-center gap-3 p-3 bg-white rounded-lg border transition-shadow ${
                            snapshot.isDragging ? 'shadow-lg border-purple-300' : 'border-gray-200'
                          }`}
                        >
                          <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <span className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                          <span className="text-xs text-gray-400">
                            {(file.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      {files.length > 0 && !hasEncryptedFile && (
        <>
          {/* Progress */}
          <div className="mt-6">
            <ProgressBar progress={progress} status={status} message={error} processingMessage="Merging PDFs — this may take a moment…" />
          </div>

          {/* Merge Button */}
          <div className="mt-8">
            <button
              onClick={handleMerge}
              disabled={files.length < 2 || status === 'uploading' || status === 'processing'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/25"
            >
              <Download className="w-5 h-5" />
              Merge & Download
            </button>
          </div>
        </>
      )}
    </div>
  );
}
