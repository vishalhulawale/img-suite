import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 minutes for large file processing
});

// Helper to create a download from a blob response
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ─── Merge ──────────────────────────────────────────────
export async function mergePDFs(
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));

  const res = await api.post('/merge', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { blob: res.data, filename: 'merged.pdf' };
}

// ─── Split ──────────────────────────────────────────────
export async function splitPDF(
  file: File,
  mode: 'ranges' | 'extract' | 'individual',
  pages: string,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('mode', mode);
  form.append('pages', pages);

  const res = await api.post('/split', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  const contentType = res.headers['content-type'] || '';
  const isZip = contentType.includes('zip');
  return {
    blob: res.data,
    filename: isZip ? 'split_pages.zip' : 'split.pdf',
  };
}

// ─── Compress ───────────────────────────────────────────
export interface CompressResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
  ratio: string;
}

export async function compressPDF(
  file: File,
  level: 'low' | 'medium' | 'high',
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<CompressResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('level', level);

  // Upload accounts for 0-50%, server-side processing accounts for 50-95%
  let uploadDone = false;
  let processingTimer: ReturnType<typeof setInterval> | null = null;

  const res = await new Promise<any>((resolve, reject) => {
    // Start simulated processing progress once upload completes
    const startProcessingProgress = () => {
      let simulatedPct = 50;
      processingTimer = setInterval(() => {
        // Slow down as we approach 90% — gives realistic feel
        const remaining = 90 - simulatedPct;
        const increment = Math.max(0.5, remaining * 0.08);
        simulatedPct = Math.min(90, simulatedPct + increment);
        onProgress?.(Math.round(simulatedPct), 'processing');
      }, 300);
    };

    api
      .post('/compress', form, {
        responseType: 'blob',
        onUploadProgress: (e) => {
          if (e.total) {
            // Upload is 0-50% of total progress
            const uploadPct = Math.round((e.loaded / e.total) * 50);
            onProgress?.(uploadPct, 'uploading');
            if (e.loaded >= e.total && !uploadDone) {
              uploadDone = true;
              onProgress?.(50, 'processing');
              startProcessingProgress();
            }
          }
        },
      })
      .then(resolve)
      .catch(reject);
  });

  // Clear the processing timer
  if (processingTimer) clearInterval(processingTimer);
  onProgress?.(95, 'processing');

  const result: CompressResult = {
    blob: res.data,
    filename: 'compressed.pdf',
    originalSize: parseInt(res.headers['x-original-size'] || '0', 10),
    compressedSize: parseInt(res.headers['x-compressed-size'] || '0', 10),
    ratio: res.headers['x-compression-ratio'] || '0%',
  };

  return result;
}

// ─── Convert ────────────────────────────────────────────

// Progress callback used by all convert functions.
// phase tells the UI exactly what is happening right now.
export type ConvertProgressCb = (
  pct: number,
  phase: 'uploading' | 'processing' | 'downloading',
  message?: string,
) => void;

/**
 * PDF → Images: 3-phase async flow with *real* progress via SSE.
 *   1. Upload file  → task_id             (0-30 %, real upload progress)
 *   2. SSE progress → page-by-page render (30-90 %, real from backend)
 *   3. Download     → finished result     (90-100 %, real download)
 */
export async function convertToImages(
  file: File,
  format: 'png' | 'jpg',
  dpi: number,
  onProgress?: ConvertProgressCb,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('format', format);
  form.append('dpi', dpi.toString());

  // Phase 1 — Upload & get task_id
  const { data } = await api.post<{ task_id: string }>('/convert/images', form, {
    timeout: 0,
    onUploadProgress: (e) => {
      if (e.total) {
        onProgress?.(Math.round((e.loaded / e.total) * 30), 'uploading');
      }
    },
  });
  const { task_id } = data;
  onProgress?.(30, 'processing', 'Starting conversion…');

  // Phase 2 — SSE for real conversion progress, with polling fallback for mobile
  await new Promise<void>((resolve, reject) => {
    let settled = false;

    // --- Polling fallback (used when SSE fails) ---
    const pollStatus = async () => {
      try {
        while (!settled) {
          const { data: d } = await api.get(`/convert/status/${task_id}`);
          if (d.status === 'processing') {
            const pct = 30 + Math.round(d.progress * 0.6);
            const msg = d.totalPages
              ? `Rendering page ${d.currentPage}/${d.totalPages}…`
              : d.message;
            onProgress?.(pct, 'processing', msg);
          } else if (d.status === 'complete') {
            settled = true;
            onProgress?.(90, 'downloading', 'Downloading result…');
            resolve();
            return;
          } else if (d.status === 'error') {
            settled = true;
            reject(new Error(d.error || 'Conversion failed'));
            return;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err: any) {
        if (!settled) {
          settled = true;
          reject(new Error(err.message || 'Failed to check conversion status'));
        }
      }
    };

    // --- Try SSE first ---
    const es = new EventSource(`/api/convert/progress/${task_id}`);
    es.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data);
        if (d.status === 'processing') {
          const pct = 30 + Math.round(d.progress * 0.6);
          const msg = d.totalPages
            ? `Rendering page ${d.currentPage}/${d.totalPages}…`
            : d.message;
          onProgress?.(pct, 'processing', msg);
        } else if (d.status === 'complete') {
          settled = true;
          onProgress?.(90, 'downloading', 'Downloading result…');
          es.close();
          resolve();
        } else if (d.status === 'error') {
          settled = true;
          es.close();
          reject(new Error(d.error || 'Conversion failed'));
        }
      } catch {
        settled = true;
        es.close();
        reject(new Error('Invalid progress data'));
      }
    };
    es.onerror = () => {
      es.close();
      if (!settled) {
        // SSE failed — fall back to polling (common on mobile Safari)
        pollStatus();
      }
    };
  });

  // Phase 3 — Download the finished result
  const res = await api.get(`/convert/download/${task_id}`, {
    responseType: 'blob',
    timeout: 0,
    onDownloadProgress: (e) => {
      if (e.total) {
        const pct = 90 + Math.round((e.loaded / e.total) * 10);
        onProgress?.(Math.min(99, pct), 'downloading', 'Downloading result…');
      }
    },
  });

  const contentType = res.headers['content-type'] || '';
  const isZip = contentType.includes('zip');
  return {
    blob: res.data,
    filename: isZip ? 'pdf_images.zip' : `page_1.${format}`,
  };
}

/**
 * Honest synchronous convert helper – upload shows real %, then an
 * indeterminate "Processing…" state (no fake simulation), then done.
 */
function syncConvert(
  url: string,
  file: File,
  extraFields?: Record<string, string>,
  onProgress?: ConvertProgressCb,
  processingMsg = 'Processing…',
) {
  const form = new FormData();
  form.append('file', file);
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) form.append(k, v);
  }

  let uploadDone = false;
  return api.post(url, form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (e.total) {
        // Cap at 60% — leave 60-100% for the server response download
        const pct = Math.round((e.loaded / e.total) * 60);
        onProgress?.(pct, 'uploading');
        if (e.loaded >= e.total && !uploadDone) {
          uploadDone = true;
          onProgress?.(60, 'processing', processingMsg);
        }
      }
    },
    onDownloadProgress: (e) => {
      if (e.total) {
        // Map server response download to 60-100%
        const pct = 60 + Math.round((e.loaded / e.total) * 40);
        onProgress?.(pct, 'downloading');
      }
    },
  });
}

export async function convertToDocx(
  file: File,
  onProgress?: ConvertProgressCb,
): Promise<{ blob: Blob; filename: string }> {
  const res = await syncConvert(
    '/convert/docx', file, undefined, onProgress,
    'Converting PDF to Word…',
  );
  return { blob: res.data, filename: 'converted.docx' };
}

export async function convertToXlsx(
  file: File,
  onProgress?: ConvertProgressCb,
): Promise<{ blob: Blob; filename: string }> {
  const res = await syncConvert(
    '/convert/xlsx', file, undefined, onProgress,
    'Extracting tables to Excel…',
  );
  return { blob: res.data, filename: 'converted.xlsx' };
}

export async function convertToPptx(
  file: File,
  onProgress?: ConvertProgressCb,
): Promise<{ blob: Blob; filename: string }> {
  const res = await syncConvert(
    '/convert/pptx', file, undefined, onProgress,
    'Converting PDF to PowerPoint…',
  );
  return { blob: res.data, filename: 'converted.pptx' };
}

export async function convertToPdf(
  file: File,
  onProgress?: ConvertProgressCb,
): Promise<{ blob: Blob; filename: string }> {
  const res = await syncConvert(
    '/convert/to-pdf', file, undefined, onProgress,
    'Converting to PDF…',
  );
  return { blob: res.data, filename: 'converted.pdf' };
}

// ─── Watermark ──────────────────────────────────────────
export interface WatermarkOptions {
  watermarkType: 'text' | 'image';
  text?: string;
  fontSize?: number;
  rotation?: number;
  opacity?: number;
  position?: string;
  color?: string;
  pages?: string;
  watermarkImage?: File;
  imageScale?: number;
}

export async function addWatermark(
  file: File,
  options: WatermarkOptions,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('watermark_type', options.watermarkType);
  if (options.text) form.append('text', options.text);
  form.append('font_size', (options.fontSize || 48).toString());
  form.append('rotation', (options.rotation ?? -45).toString());
  form.append('opacity', (options.opacity ?? 0.3).toString());
  form.append('position', options.position || 'center');
  form.append('color', options.color || '#888888');
  form.append('pages', options.pages || 'all');
  if (options.watermarkImage) form.append('watermark_image', options.watermarkImage);
  form.append('image_scale', (options.imageScale ?? 0.3).toString());

  const res = await api.post('/watermark', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { blob: res.data, filename: 'watermarked.pdf' };
}

export interface WatermarkPreview {
  width: number;
  height: number;
  image: string;        // base64 PNG
  totalPages: number;
}

export async function getWatermarkPreview(file: File): Promise<WatermarkPreview> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/watermark/preview', form);
  return res.data;
}

// ─── eSign ──────────────────────────────────────────────
export interface SignaturePlacement {
  type: 'draw' | 'image' | 'text';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: string;
  imageIndex?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
}

export async function esignPDF(
  file: File,
  signatures: SignaturePlacement[],
  signatureImages?: File[],
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('signatures', JSON.stringify(signatures));
  if (signatureImages) {
    signatureImages.forEach((img) => form.append('signature_images', img));
  }

  const res = await api.post('/esign', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { blob: res.data, filename: 'signed.pdf' };
}

export interface PagePreview {
  page: number;
  width: number;
  height: number;
  image: string;
}

export async function getEsignPreview(
  file: File,
  dpi: number = 100,
): Promise<{ pages: PagePreview[]; total: number }> {
  const form = new FormData();
  form.append('file', file);
  form.append('dpi', dpi.toString());

  const res = await api.post('/esign/preview', form);
  return res.data;
}

// ─── Organize ───────────────────────────────────────────
export interface OrganizePageInfo {
  page: number;
  width: number;
  height: number;
  rotation: number;
  thumbnail: string;
}

export async function getOrganizePreview(
  file: File,
  dpi: number = 72,
): Promise<{ pages: OrganizePageInfo[]; total: number }> {
  const form = new FormData();
  form.append('file', file);
  form.append('dpi', dpi.toString());

  const res = await api.post('/organize/preview', form);
  return res.data;
}

export async function organizePDF(
  file: File,
  operations: object[],
  insertFiles?: File[],
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('operations', JSON.stringify(operations));
  if (insertFiles) {
    insertFiles.forEach((f) => form.append('insert_files', f));
  }

  const res = await api.post('/organize/apply', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { blob: res.data, filename: 'organized.pdf' };
}

// ─── Protect ────────────────────────────────────────────

export async function checkPdfEncrypted(file: File): Promise<boolean> {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await api.post('/pdf/check-encrypted', form);
    return res.data.encrypted === true;
  } catch {
    return false;
  }
}

export interface ProtectOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrint?: boolean;
  allowCopy?: boolean;
  allowModify?: boolean;
  allowAnnotate?: boolean;
  encryption?: 'AES-256' | 'AES-128' | 'RC4-128';
}

export async function protectPDF(
  file: File,
  options: ProtectOptions,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('user_password', options.userPassword);
  form.append('owner_password', options.ownerPassword || '');
  form.append('allow_print', String(options.allowPrint ?? true));
  form.append('allow_copy', String(options.allowCopy ?? true));
  form.append('allow_modify', String(options.allowModify ?? false));
  form.append('allow_annotate', String(options.allowAnnotate ?? true));
  form.append('encryption', options.encryption || 'AES-256');

  const res = await api.post('/protect', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { blob: res.data, filename: 'protected.pdf' };
}

// ─── Unlock ─────────────────────────────────────────────
export async function unlockPDF(
  file: File,
  password: string,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('password', password);

  const res = await api.post('/unlock', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { blob: res.data, filename: 'unlocked.pdf' };
}

// ─── Redact ─────────────────────────────────────────────
export interface RedactArea {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getRedactPreview(
  file: File,
  dpi: number = 100,
): Promise<{ pages: PagePreview[]; total: number }> {
  const form = new FormData();
  form.append('file', file);
  form.append('dpi', dpi.toString());

  const res = await api.post('/redact/preview', form);
  return res.data;
}

export async function searchRedactKeyword(
  file: File,
  keyword: string,
): Promise<{ keyword: string; matches: RedactArea[]; count: number }> {
  const form = new FormData();
  form.append('file', file);
  form.append('keyword', keyword);

  const res = await api.post('/redact/search', form);
  return res.data;
}

export async function applyRedactions(
  file: File,
  redactions: RedactArea[],
  fillColor: string = '#000000',
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('redactions', JSON.stringify(redactions));
  form.append('fill_color', fillColor);

  const res = await api.post('/redact/apply', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { blob: res.data, filename: 'redacted.pdf' };
}

export default api;
