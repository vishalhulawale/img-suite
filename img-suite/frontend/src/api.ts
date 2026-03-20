import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 minutes for large image processing (e.g. background removal)
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

// Helper to create a preview URL from a blob
export function createPreviewUrl(blob: Blob): string {
  return window.URL.createObjectURL(blob);
}

// ─── Compress ───────────────────────────────────────────
export interface CompressResult {
  blob: Blob;
  filename: string;
  originalSize: number;
  compressedSize: number;
  ratio: string;
  previewUrl: string;
}

export async function compressImage(
  file: File,
  level: 'low' | 'medium' | 'high',
  targetSizeKb: number | null,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<CompressResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('level', level);
  if (targetSizeKb) {
    form.append('target_size_kb', String(targetSizeKb));
  }

  let uploadDone = false;
  let processingTimer: ReturnType<typeof setInterval> | null = null;

  const res = await new Promise<any>((resolve, reject) => {
    const startProcessingProgress = () => {
      let simulatedPct = 50;
      processingTimer = setInterval(() => {
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
            const pct = Math.round((e.loaded / e.total) * 50);
            onProgress?.(pct, 'uploading');
          }
          if (e.loaded === e.total && !uploadDone) {
            uploadDone = true;
            startProcessingProgress();
          }
        },
      })
      .then((r) => {
        if (processingTimer) clearInterval(processingTimer);
        resolve(r);
      })
      .catch((err) => {
        if (processingTimer) clearInterval(processingTimer);
        reject(err);
      });
  });

  const originalSize = parseInt(res.headers['x-original-size'] || '0', 10);
  const compressedSize = parseInt(res.headers['x-compressed-size'] || '0', 10);
  const ratio = res.headers['x-compression-ratio'] || '0%';
  const blob = res.data as Blob;

  return {
    blob,
    filename: 'compressed.jpg',
    originalSize,
    compressedSize,
    ratio,
    previewUrl: createPreviewUrl(blob),
  };
}

// ─── Background Removal ────────────────────────────────
export interface RemoveBgResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
}

export async function removeBackground(
  file: File,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<RemoveBgResult> {
  const form = new FormData();
  form.append('file', file);

  let uploadDone = false;
  let processingTimer: ReturnType<typeof setInterval> | null = null;

  const res = await new Promise<any>((resolve, reject) => {
    const startProcessingProgress = () => {
      let simulatedPct = 50;
      processingTimer = setInterval(() => {
        const remaining = 90 - simulatedPct;
        const increment = Math.max(0.3, remaining * 0.05);
        simulatedPct = Math.min(90, simulatedPct + increment);
        onProgress?.(Math.round(simulatedPct), 'processing');
      }, 400);
    };

    api
      .post('/remove-background', form, {
        responseType: 'blob',
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 50);
            onProgress?.(pct, 'uploading');
          }
          if (e.loaded === e.total && !uploadDone) {
            uploadDone = true;
            startProcessingProgress();
          }
        },
      })
      .then((r) => {
        if (processingTimer) clearInterval(processingTimer);
        resolve(r);
      })
      .catch((err) => {
        if (processingTimer) clearInterval(processingTimer);
        reject(err);
      });
  });

  const blob = res.data as Blob;

  return {
    blob,
    filename: 'no-background.png',
    previewUrl: createPreviewUrl(blob),
  };
}

// ─── Passport Photo ────────────────────────────────────
export interface PassportPreset {
  width: number;
  height: number;
  label: string;
}

export async function getPassportPresets(): Promise<Record<string, PassportPreset>> {
  const res = await api.get('/passport/presets');
  return res.data;
}

export interface PassportResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
}

export async function createPassportPhoto(
  file: File,
  preset: string,
  bgColor: string,
  offsetX: number,
  offsetY: number,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<PassportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('preset', preset);
  form.append('bg_color', bgColor);
  form.append('offset_x', String(offsetX));
  form.append('offset_y', String(offsetY));

  let uploadDone = false;
  let processingTimer: ReturnType<typeof setInterval> | null = null;

  const res = await new Promise<any>((resolve, reject) => {
    const startProcessingProgress = () => {
      let simulatedPct = 50;
      processingTimer = setInterval(() => {
        const remaining = 90 - simulatedPct;
        const increment = Math.max(0.5, remaining * 0.08);
        simulatedPct = Math.min(90, simulatedPct + increment);
        onProgress?.(Math.round(simulatedPct), 'processing');
      }, 300);
    };

    api
      .post('/passport', form, {
        responseType: 'blob',
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 50);
            onProgress?.(pct, 'uploading');
          }
          if (e.loaded === e.total && !uploadDone) {
            uploadDone = true;
            startProcessingProgress();
          }
        },
      })
      .then((r) => {
        if (processingTimer) clearInterval(processingTimer);
        resolve(r);
      })
      .catch((err) => {
        if (processingTimer) clearInterval(processingTimer);
        reject(err);
      });
  });

  const blob = res.data as Blob;

  return {
    blob,
    filename: `passport_${preset}.jpg`,
    previewUrl: createPreviewUrl(blob),
  };
}

// ─── Shared progress helper ────────────────────────────
function withProgress(
  endpoint: string,
  form: FormData,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<any> {
  let uploadDone = false;
  let processingTimer: ReturnType<typeof setInterval> | null = null;

  return new Promise<any>((resolve, reject) => {
    const startProcessingProgress = () => {
      let simulatedPct = 50;
      processingTimer = setInterval(() => {
        const remaining = 90 - simulatedPct;
        const increment = Math.max(0.5, remaining * 0.08);
        simulatedPct = Math.min(90, simulatedPct + increment);
        onProgress?.(Math.round(simulatedPct), 'processing');
      }, 300);
    };

    api
      .post(endpoint, form, {
        responseType: 'blob',
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 50);
            onProgress?.(pct, 'uploading');
          }
          if (e.loaded === e.total && !uploadDone) {
            uploadDone = true;
            startProcessingProgress();
          }
        },
      })
      .then((r) => {
        if (processingTimer) clearInterval(processingTimer);
        resolve(r);
      })
      .catch((err) => {
        if (processingTimer) clearInterval(processingTimer);
        reject(err);
      });
  });
}

// ─── Format Converter ──────────────────────────────────
export interface ConvertResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
  originalSize: number;
  outputSize: number;
  originalFormat: string;
  outputFormat: string;
  transparencyWarning: string;
}

export async function convertImage(
  file: File,
  format: string,
  quality: number,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<ConvertResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('format', format);
  form.append('quality', String(quality));

  const res = await withProgress('/convert', form, onProgress);

  return {
    blob: res.data as Blob,
    filename: `converted.${format}`,
    previewUrl: createPreviewUrl(res.data),
    originalSize: parseInt(res.headers['x-original-size'] || '0', 10),
    outputSize: parseInt(res.headers['x-output-size'] || '0', 10),
    originalFormat: res.headers['x-original-format'] || '',
    outputFormat: res.headers['x-output-format'] || '',
    transparencyWarning: res.headers['x-transparency-warning'] || '',
  };
}

// ─── Crop & Resize ─────────────────────────────────────
export interface CropResizeResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export async function cropResizeImage(
  file: File,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  resizeW: number,
  resizeH: number,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<CropResizeResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('crop_x', String(Math.round(cropX)));
  form.append('crop_y', String(Math.round(cropY)));
  form.append('crop_w', String(Math.round(cropW)));
  form.append('crop_h', String(Math.round(cropH)));
  form.append('resize_w', String(Math.round(resizeW)));
  form.append('resize_h', String(Math.round(resizeH)));

  const res = await withProgress('/crop-resize', form, onProgress);

  return {
    blob: res.data as Blob,
    filename: 'cropped.jpg',
    previewUrl: createPreviewUrl(res.data),
    originalWidth: parseInt(res.headers['x-original-width'] || '0', 10),
    originalHeight: parseInt(res.headers['x-original-height'] || '0', 10),
    outputWidth: parseInt(res.headers['x-output-width'] || '0', 10),
    outputHeight: parseInt(res.headers['x-output-height'] || '0', 10),
  };
}

// ─── Auto Enhance ──────────────────────────────────────
export interface EnhanceResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
}

export async function enhanceImage(
  file: File,
  intensity: 'low' | 'medium' | 'high',
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<EnhanceResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('intensity', intensity);

  const res = await withProgress('/enhance', form, onProgress);

  return {
    blob: res.data as Blob,
    filename: 'enhanced.jpg',
    previewUrl: createPreviewUrl(res.data),
  };
}

// ─── Image Upscaler ────────────────────────────────────
export interface UpscaleResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  scaleFactor: number;
}

export async function upscaleImage(
  file: File,
  scale: number,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<UpscaleResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('scale', String(scale));

  const res = await withProgress('/upscale', form, onProgress);

  return {
    blob: res.data as Blob,
    filename: `upscaled_${scale}x.jpg`,
    previewUrl: createPreviewUrl(res.data),
    originalWidth: parseInt(res.headers['x-original-width'] || '0', 10),
    originalHeight: parseInt(res.headers['x-original-height'] || '0', 10),
    outputWidth: parseInt(res.headers['x-output-width'] || '0', 10),
    outputHeight: parseInt(res.headers['x-output-height'] || '0', 10),
    scaleFactor: parseInt(res.headers['x-scale-factor'] || '2', 10),
  };
}

// ─── Watermark Studio ──────────────────────────────────
export interface WatermarkResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
}

export async function applyWatermark(
  file: File,
  options: {
    text?: string;
    watermarkImage?: File;
    position: string;
    opacity: number;
    fontSize: number;
    color: string;
    rotation: number;
    padding: number;
  },
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<WatermarkResult> {
  const form = new FormData();
  form.append('file', file);
  if (options.text) form.append('text', options.text);
  if (options.watermarkImage) form.append('watermark_image', options.watermarkImage);
  form.append('position', options.position);
  form.append('opacity', String(options.opacity));
  form.append('font_size', String(options.fontSize));
  form.append('color', String(options.color));
  form.append('rotation', String(options.rotation));
  form.append('padding', String(options.padding));

  const res = await withProgress('/watermark', form, onProgress);

  return {
    blob: res.data as Blob,
    filename: 'watermarked.jpg',
    previewUrl: createPreviewUrl(res.data),
  };
}

// ─── Text on Image ─────────────────────────────────────
export interface TextLayer {
  text: string;
  x: number;
  y: number;
  font_size: number;
  bold: boolean;
  color: string;
  opacity: number;
  align: string;
  shadow: boolean;
  outline: boolean;
  bg_box: boolean;
  bg_box_color: string;
  bg_box_opacity: number;
}

export interface TextOverlayResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
}

export async function applyTextOverlay(
  file: File,
  layers: TextLayer[],
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<TextOverlayResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('layers', JSON.stringify(layers));

  const res = await withProgress('/text-overlay', form, onProgress);

  return {
    blob: res.data as Blob,
    filename: 'text-image.jpg',
    previewUrl: createPreviewUrl(res.data),
  };
}

// ─── Profile Picture ───────────────────────────────────
export interface ProfilePicPreset {
  size: number;
  label: string;
}

export async function getProfilePicPresets(): Promise<Record<string, ProfilePicPreset>> {
  const res = await api.get('/profile-picture/presets');
  return res.data;
}

export interface ProfilePicResult {
  blob: Blob;
  filename: string;
  previewUrl: string;
}

export async function createProfilePicture(
  file: File,
  platform: string,
  customSize: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
  bgMode: string,
  bgColor: string,
  onProgress?: (pct: number, phase: 'uploading' | 'processing') => void,
): Promise<ProfilePicResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('platform', platform);
  form.append('custom_size', String(customSize));
  form.append('offset_x', String(offsetX));
  form.append('offset_y', String(offsetY));
  form.append('zoom', String(zoom));
  form.append('bg_mode', bgMode);
  form.append('bg_color', bgColor);

  const res = await withProgress('/profile-picture', form, onProgress);

  return {
    blob: res.data as Blob,
    filename: `profile_${platform}.jpg`,
    previewUrl: createPreviewUrl(res.data),
  };
}
