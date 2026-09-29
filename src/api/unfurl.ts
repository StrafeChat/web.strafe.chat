import { api } from './client';

/** An image or video rendition with its intrinsic size when the page declared one. */
export interface UnfurlMedia {
  url: string;
  width?: number;
  height?: number;
}

/** Link-preview metadata from the server's /unfurl endpoint (Open Graph / Twitter / meta),
 * modelled on Discord's rich embed. */
export interface LinkMetadata {
  /** og:type (article, website, video.*, image.*). */
  type?: string;
  title?: string;
  description?: string;
  /** Final/canonical URL. */
  url?: string;
  /** Provider name (shown as the footer / site line). */
  site_name?: string;
  author?: string;
  author_url?: string;
  /** Accent colour (theme-color). */
  color?: string;
  /** Favicon. */
  icon?: string;
  image?: UnfurlMedia;
  /** True for a full-width image, false for a small right-hand thumbnail. */
  image_large?: boolean;
  video?: UnfurlMedia;
  /** "video/mp4" (directly playable) vs "text/html" (an embed page we can't inline). */
  video_type?: string;
}

/** Fetch preview metadata for a URL. Returns {} when the link has nothing to preview. */
export function fetchUnfurl(url: string): Promise<LinkMetadata> {
  return api<LinkMetadata>(`/unfurl?url=${encodeURIComponent(url)}`);
}
