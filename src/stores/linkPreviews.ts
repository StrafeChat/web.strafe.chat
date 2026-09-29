/**
 * Client-side cache for link-preview metadata. Each unique URL is unfurled once (the server
 * caches too) and the result kept for the session, so re-rendering a message list doesn't
 * re-request, and the same link in several messages shares one fetch. A preview with no title,
 * description or image is treated as "nothing to show" (status 'empty') so the card is hidden.
 */

import { createStore } from 'solid-js/store';
import { fetchUnfurl, type LinkMetadata } from '../api/unfurl';

export type LinkPreviewStatus = 'loading' | 'ok' | 'empty' | 'error';

export interface LinkPreviewEntry {
  status: LinkPreviewStatus;
  data?: LinkMetadata;
}

interface LinkPreviewState {
  byUrl: Record<string, LinkPreviewEntry>;
}

const [linkPreviews, setLinkPreviews] = createStore<LinkPreviewState>({ byUrl: {} });

export { linkPreviews };

function hasContent(m: LinkMetadata): boolean {
  return !!(m.title || m.description || m.image);
}

/** Fetch (once) the preview for a URL; components read linkPreviews.byUrl[url] reactively. */
export function ensureLinkPreview(url: string): void {
  if (linkPreviews.byUrl[url]) return; // already fetched or in flight
  setLinkPreviews('byUrl', url, { status: 'loading' });
  fetchUnfurl(url)
    .then((data) => setLinkPreviews('byUrl', url, { status: hasContent(data) ? 'ok' : 'empty', data }))
    .catch(() => setLinkPreviews('byUrl', url, { status: 'error' }));
}
