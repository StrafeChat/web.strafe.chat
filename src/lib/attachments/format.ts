/** Presentation helpers shared by the composer's pending strip and the message renderer. */

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACHMENTS_PER_MESSAGE = 10;

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

export function attachmentKind(contentType: string | undefined, filename?: string): AttachmentKind {
  const t = (contentType ?? '').toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  const ext = (filename ?? '').toLowerCase().split('.').pop() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'opus'].includes(ext)) return 'audio';
  return 'file';
}

/** Font Awesome icon for a non-media file. */
export function fileIcon(contentType: string | undefined, filename?: string): string {
  const t = (contentType ?? '').toLowerCase();
  const ext = (filename ?? '').toLowerCase().split('.').pop() ?? '';
  if (t === 'application/pdf' || ext === 'pdf') return 'fa-file-pdf';
  if (t.includes('zip') || t.includes('compressed') || ['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return 'fa-file-zipper';
  if (t.includes('word') || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'fa-file-word';
  if (t.includes('sheet') || t.includes('excel') || ['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'fa-file-excel';
  if (t.includes('presentation') || t.includes('powerpoint') || ['ppt', 'pptx', 'odp'].includes(ext)) return 'fa-file-powerpoint';
  if (t.startsWith('text/') || ['txt', 'md', 'log'].includes(ext)) return 'fa-file-lines';
  if (['js', 'ts', 'tsx', 'jsx', 'go', 'py', 'rs', 'c', 'cpp', 'h', 'java', 'json', 'yaml', 'yml', 'toml', 'sh', 'html', 'css'].includes(ext)) return 'fa-file-code';
  return 'fa-file';
}

/** Natural dimensions of an image file, or null if it can't be decoded. */
export function readImageDimensions(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Fit (w, h) inside a box, preserving aspect ratio; never upscale. */
export function fitWithin(w: number, h: number, maxW: number, maxH: number): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: maxW, height: Math.round(maxH * 0.6) };
  const scale = Math.min(1, maxW / w, maxH / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
