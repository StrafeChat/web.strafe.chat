import type { AttachmentKeyMaterial } from './crypto';

/**
 * What the UI renders for an attachment, regardless of where its metadata came from
 * (the server row in a plaintext room, or the decrypted message body in an E2EE room).
 */
export interface AttachmentView {
  id: string;
  /** Nebula URL. For encrypted attachments this is the ciphertext blob. */
  url: string;
  filename: string;
  contentType: string;
  /** Plaintext size in bytes. */
  size: number;
  width?: number;
  height?: number;
  /** Present for E2EE attachments: fetch `url`, decrypt with this, then display. */
  encryption?: AttachmentKeyMaterial;
  /** Local object URL of the file being sent - shown while the upload is in flight. */
  previewUrl?: string;
  uploading?: boolean;
  /** 0..1 upload progress while `uploading`. */
  progress?: number;
}

/** Attachment metadata as carried inside a Megolm-encrypted message body. */
export interface EncryptedAttachmentMeta {
  id: string;
  url: string;
  filename: string;
  content_type: string;
  size: number;
  width?: number;
  height?: number;
  key: string;
  iv: string;
}

export function viewFromEncryptedMeta(m: EncryptedAttachmentMeta): AttachmentView {
  return {
    id: m.id,
    url: m.url,
    filename: m.filename || 'file',
    contentType: m.content_type || 'application/octet-stream',
    size: m.size,
    width: m.width,
    height: m.height,
    encryption: { key: m.key, iv: m.iv },
  };
}

export function encryptedMetaFromView(v: AttachmentView): EncryptedAttachmentMeta | null {
  if (!v.encryption) return null;
  return {
    id: v.id,
    url: v.url,
    filename: v.filename,
    content_type: v.contentType,
    size: v.size,
    width: v.width,
    height: v.height,
    key: v.encryption.key,
    iv: v.encryption.iv,
  };
}

export function isEncryptedAttachmentMeta(x: unknown): x is EncryptedAttachmentMeta {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.url === 'string' &&
    typeof d.key === 'string' &&
    typeof d.iv === 'string' &&
    typeof d.size === 'number'
  );
}
