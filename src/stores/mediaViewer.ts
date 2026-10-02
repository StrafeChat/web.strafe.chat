import { createStore } from 'solid-js/store';

/**
 * One image the viewer can show. Deliberately loose about provenance: a message attachment, a
 * link-preview thumbnail and a bare image URL all resolve to "a URL plus what we know about
 * it", so the viewer doesn't care which surface opened it.
 *
 * `url` is always the *displayable* one - for an E2EE attachment that's the decrypted blob
 * URL, not the ciphertext URL on the CDN - so callers resolve it before calling `open`.
 */
export type MediaViewerItem = {
  url: string;
  filename: string;
  contentType?: string;
  size?: number;
  width?: number;
  height?: number;
};

type State = {
  open: boolean;
  items: MediaViewerItem[];
  index: number;
  /** Kept so the viewer can show where you are: "3 / 8". */
  sourceLabel?: string;
};

export const [mediaViewer, setMediaViewer] = createStore<State>({
  open: false,
  items: [],
  index: 0,
  sourceLabel: undefined,
});

/**
 * Open the viewer on `items[index]`.
 *
 * A list, not a single image, so the arrows and the filmstrip have something to move
 * between: opening the third image of a message should let you walk to the fourth. `items`
 * is whatever set the caller had to hand - one message's attachments, one embed's images - and
 * the viewer never reaches outside it.
 */
export function openMediaViewer(items: MediaViewerItem[], index = 0, sourceLabel?: string): void {
  if (!items.length) return;
  const clamped = Math.max(0, Math.min(index, items.length - 1));
  setMediaViewer({ open: true, items: [...items], index: clamped, sourceLabel });
}

export function closeMediaViewer(): void {
  setMediaViewer({ open: false, items: [], index: 0, sourceLabel: undefined });
}

function step(delta: number): void {
  const { items, index } = mediaViewer;
  if (items.length < 2) return;
  // Wrap: an image list is a loop, and stopping at either end makes the arrows feel broken.
  setMediaViewer('index', (index + delta + items.length) % items.length);
}

export function nextMedia(): void {
  step(1);
}

export function prevMedia(): void {
  step(-1);
}

export function goToMedia(index: number): void {
  if (index < 0 || index >= mediaViewer.items.length) return;
  setMediaViewer('index', index);
}