/**
 * The non-visual rules for a bot's rich embeds (the card is components/messageList/MessageEmbed).
 *
 * The one rule that matters most: an embed's pictures load only from this instance - its own
 * CDN, or the image proxy the server names in `proxy_url` / `proxy_icon_url`. The `url` a bot
 * wrote can point anywhere, and loading it straight from every reader's browser would hand that
 * site each reader's IP address and the moment they looked. Without a proxied copy the card
 * offers the picture behind a click that says so, and never loads it on its own.
 */
import type { Embed, EmbedImage } from '../../api/messages';
import { apiUrl, cdnUrl } from '../runtimeConfig';

/** A URL a link or an <img> may carry: http(s) only, anything else is dropped. */
export function safeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** The URL without its query and fragment, for comparing two references to one file. */
function bareUrl(raw: string): string {
  return raw.split('#')[0]!.split('?')[0]!;
}

/** Whether a URL is on this instance's own object store, which needs no proxy. */
export function isOwnCdnUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  const base = cdnUrl();
  return raw === base || raw.startsWith(`${base}/`);
}

/**
 * A proxy URL from the server: absolute, or a path the client resolves against its own API base
 * (an instance with no public URL configured hands out `/media/v1/...`).
 */
function resolveProxyUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('/') && !raw.startsWith('//')) return safeHttpUrl(`${apiUrl()}${raw}`);
  return safeHttpUrl(raw);
}

/**
 * Where to load an embed picture from, or undefined when there is no copy on this instance
 * (the card then offers a click-to-load placeholder for `url`). The proxy wins; the source
 * itself only when it already lives on the instance's CDN (an `attachment://` image).
 */
export function embedImageSrc(url: string | undefined, proxyUrl: string | undefined): string | undefined {
  const proxied = resolveProxyUrl(proxyUrl);
  if (proxied) return proxied;
  const direct = safeHttpUrl(url);
  return direct && isOwnCdnUrl(direct) ? direct : undefined;
}

/** The host a click-to-load placeholder names, so the reader knows who they would be talking to. */
export function urlHost(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return new URL(raw).host;
  } catch {
    return '';
  }
}

/** `#rrggbb` for an embed colour (0..0xFFFFFF). Built from a number, so it can only ever be a colour. */
export function embedColorHex(color: unknown): string | undefined {
  if (typeof color !== 'number' || !Number.isInteger(color) || color < 0 || color > 0xffffff) return undefined;
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * Whether a URL is named like a picture that animates (GIF, WebP, APNG). Only the card's GIF badge
 * reads it. What is held still for a reader who asked for reduced motion is every picture, never
 * judged by this name: the proxy serves whatever bytes it finds, so `https://host/anim` or an
 * APNG called `x.png` can animate too.
 */
export function maybeAnimated(raw: string | undefined): boolean {
  return !!raw && /\.(gif|webp|apng)$/i.test(bareUrl(raw));
}

/** The embed's pictures, image first. */
function picturesOf(e: Embed): EmbedImage[] {
  return [e.image, e.thumbnail].filter((p): p is EmbedImage => !!p && typeof p.url === 'string');
}

/**
 * The URLs of every picture the embeds carry, without query or fragment, which the message's
 * file grid matches against its own attachments so the same image is not shown a second time.
 * A bot's `attachment://` picture resolves to the URL of one of those attachments: on this
 * instance's CDN, or on the origin's when the message came from another instance, so the match
 * itself is the whole rule and where the file lives does not enter into it.
 */
export function embedAttachmentUrls(embeds: readonly Embed[] | undefined): Set<string> {
  const urls = new Set<string>();
  for (const e of embeds ?? []) {
    for (const p of picturesOf(e)) urls.add(bareUrl(p.url));
    for (const icon of [e.author?.icon_url, e.footer?.icon_url]) if (typeof icon === 'string' && icon) urls.add(bareUrl(icon));
  }
  return urls;
}

/** The attachments a message shows in its file grid beside these (shown) embeds: all of them
 * but the pictures an embed already carries. The same array when nothing is left out. */
export function attachmentsBesideEmbeds<T extends { url: string }>(attachments: T[], embeds: readonly Embed[]): T[] {
  if (attachments.length === 0 || embeds.length === 0) return attachments;
  const embedded = embedAttachmentUrls(embeds);
  if (embedded.size === 0) return attachments;
  const left = attachments.filter((a) => !embedded.has(bareUrl(a.url)));
  return left.length === attachments.length ? attachments : left;
}

/**
 * A message's preview links without the ones an embed is already a card for. Both sides are
 * compared normalized (URL.href): the text keeps a link as it was written, while an embed's
 * `url` arrives canonicalized, so `https://Example.com` and `https://example.com/` are one link
 * and get one card, the embed's. The same array when nothing is left out.
 */
export function previewUrlsBesideEmbeds(urls: string[], embedLinks: readonly string[] | undefined): string[] {
  if (!embedLinks?.length || urls.length === 0) return urls;
  const shown = new Set(embedLinks.map((u) => safeHttpUrl(u)).filter((u): u is string => !!u));
  return shown.size === 0 ? urls : urls.filter((u) => !shown.has(safeHttpUrl(u) ?? u));
}

/** Whether an embed has anything to show (the server refuses one that does not). */
export function embedHasContent(e: Embed): boolean {
  return !!(e.title || e.description || e.fields?.length || e.footer?.text || e.author?.name || e.image?.url || e.thumbnail?.url);
}

/** The text that stands in for an embed-only message in a reply strip or a notification: the
 * first embed's title, else its description. */
export function embedPreviewText(embeds: readonly Embed[] | undefined): string {
  for (const e of embeds ?? []) {
    const text = (e.title || e.description || '').trim();
    if (text) return text;
  }
  return '';
}

/** One field's place in Discord's 12-column field grid. */
export interface FieldPlacement {
  /** CSS grid-column value. */
  column: string;
}

/**
 * Discord's field layout: a field that is not inline takes the whole row; consecutive inline
 * fields share rows, up to three to a row (two when the embed has a thumbnail beside them), and
 * the short last row of a run spreads its fields over the full width.
 */
export function placeFields(fields: readonly { inline?: boolean }[], hasThumbnail: boolean): FieldPlacement[] {
  const perRow = hasThumbnail ? 2 : 3;
  const out: FieldPlacement[] = [];
  let i = 0;
  while (i < fields.length) {
    if (!fields[i]!.inline) {
      out.push({ column: '1 / -1' });
      i++;
      continue;
    }
    let run = 0;
    while (i + run < fields.length && fields[i + run]!.inline) run++;
    for (let k = 0; k < run; k++) {
      const rowStart = k - (k % perRow);
      const inRow = Math.min(perRow, run - rowStart);
      const span = 12 / inRow;
      const col = (k - rowStart) * span + 1;
      out.push({ column: `${col} / span ${span}` });
    }
    i += run;
  }
  return out;
}
