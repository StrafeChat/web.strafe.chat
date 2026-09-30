import { createSignal, onCleanup } from 'solid-js';
import { ATTACHMENTS_PER_MESSAGE, ATTACHMENT_MAX_BYTES, attachmentKind, formatFileSize, readImageDimensions } from './format';
import { t } from '../../i18n';

/** A file queued in the composer, not yet uploaded. */
export interface PendingAttachment {
  localId: string;
  file: File;
  /** Object URL for image/video previews (revoked on removal). */
  previewUrl?: string;
  width?: number;
  height?: number;
}

let nextLocalId = 1;

/**
 * Per-composer queue of files to send with the next message. Validates size/count up
 * front (so the user hears about a too-large file when they pick it, not after the
 * message fails), measures images for layout, and owns the preview object URLs.
 */
export function createAttachmentDraft(opts: { maxFiles?: number; maxBytes?: number } = {}) {
  const maxFiles = opts.maxFiles ?? ATTACHMENTS_PER_MESSAGE;
  const maxBytes = opts.maxBytes ?? ATTACHMENT_MAX_BYTES;
  const [items, setItems] = createSignal<PendingAttachment[]>([]);
  const [error, setError] = createSignal('');

  async function addFiles(files: Iterable<File>): Promise<void> {
    const incoming = [...files].filter((f) => f && f.size >= 0);
    if (incoming.length === 0) return;
    const room = maxFiles - items().length;
    if (room <= 0) {
      setError(t('attachments.tooMany', { count: maxFiles }));
      return;
    }
    const accepted: PendingAttachment[] = [];
    let problem = '';
    for (const file of incoming) {
      if (accepted.length >= room) {
        problem = t('attachments.tooMany', { count: maxFiles });
        break;
      }
      if (file.size > maxBytes) {
        problem = t('attachments.tooLarge', { name: file.name || t('attachments.thatFile'), max: formatFileSize(maxBytes) });
        continue;
      }
      if (file.size === 0) {
        problem = t('attachments.empty', { name: file.name || t('attachments.thatFile') });
        continue;
      }
      const item: PendingAttachment = { localId: `att-${Date.now()}-${nextLocalId++}`, file };
      const kind = attachmentKind(file.type, file.name);
      // Audio gets a URL too so a recorded voice message can be played back from the
      // composer's pending strip before it is sent, and so the optimistic message shows a
      // real waveform rather than waiting on the upload.
      if (kind === 'image' || kind === 'video' || kind === 'audio') item.previewUrl = URL.createObjectURL(file);
      if (kind === 'image') {
        const dims = await readImageDimensions(file);
        if (dims) {
          item.width = dims.width;
          item.height = dims.height;
        }
      }
      accepted.push(item);
    }
    if (accepted.length) setItems((prev) => [...prev, ...accepted]);
    setError(problem);
  }

  function remove(localId: string) {
    setItems((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
    setError('');
  }

  /** Hand the queued files off (to sendMessage) and reset. Preview URLs are NOT revoked
   * here - the optimistic message keeps showing them until the upload lands. */
  function take(): PendingAttachment[] {
    const list = items();
    setItems([]);
    setError('');
    return list;
  }

  /** Put files back in the queue after a failed send so the user can retry. */
  function restore(list: PendingAttachment[]) {
    if (list.length === 0) return;
    setItems((prev) => [...list, ...prev.filter((p) => !list.some((l) => l.localId === p.localId))].slice(0, maxFiles));
  }

  function clear() {
    for (const p of items()) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    setItems([]);
    setError('');
  }

  onCleanup(clear);

  return { items, error, setError, addFiles, remove, take, restore, clear };
}

export type AttachmentDraft = ReturnType<typeof createAttachmentDraft>;
