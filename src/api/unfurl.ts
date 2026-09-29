import { api } from './client';

/** Link-preview metadata from the server's /unfurl endpoint (Open Graph / Twitter / meta). */
export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  icon?: string;
  site_name?: string;
  theme_color?: string;
  /** Final URL after redirects. */
  url?: string;
}

/** Fetch preview metadata for a URL. Returns {} when the link has nothing to preview. */
export function fetchUnfurl(url: string): Promise<LinkMetadata> {
  return api<LinkMetadata>(`/unfurl?url=${encodeURIComponent(url)}`);
}
