/**
 * Emoji image providers. Each turns an emoji sequence into an image URL (or, for the
 * native provider, opts out so the OS font renders it).
 *
 * Every image set is served from the instance's own CDN (nebula), never a third-party host:
 * the sets are seeded into nebula and served under `/v1/emoji/<set>/…` (see the emoji
 * seeding in the nebula repo, and deploy/Caddyfile's `/cdn` route). This keeps to the
 * project's privacy-first and self-hostable principles - rendering an emoji is a request to
 * the instance you are already talking to, so no viewer's IP or referrer leaks to an
 * outside CDN, and an instance with no outbound internet access still renders every emoji.
 * The per-set file-name conventions below mirror each upstream project's own layout, so
 * seeding is a straight copy of the upstream assets.
 */
import { cdnUrl } from '../runtimeConfig';

export type EmojiProviderId = 'twemoji' | 'noto' | 'openmoji' | 'native';

export interface EmojiProvider {
  id: EmojiProviderId;
  name: string;
  description: string;
  /** null = render the emoji as text with the system font. */
  imageUrl: ((emoji: string) => string) | null;
}

/** Credit for a bundled artwork set - shown in the appearance settings and CREDITS.md. */
export interface EmojiAttribution {
  id: Exclude<EmojiProviderId, 'native'>;
  name: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

/** Hex code points of a sequence, lowercase, joined by `sep`. */
function codepoints(emoji: string, sep: string, opts: { stripVS16: 'never' | 'always' | 'unlessZwj' }): string {
  let s = emoji;
  if (opts.stripVS16 === 'always' || (opts.stripVS16 === 'unlessZwj' && !s.includes('‍'))) {
    s = s.replace(/️/g, '');
  }
  const out: string[] = [];
  for (const ch of s) out.push(ch.codePointAt(0)!.toString(16));
  return out.join(sep);
}

// The instance CDN base for a seeded emoji set. Resolved once at load, like the API client:
// config.js (which sets window.__STRAFE_CONFIG__) is loaded before this bundle.
const emojiBase = (set: string): string => `${cdnUrl()}/v1/emoji/${set}/`;

const TWEMOJI_BASE = emojiBase('twemoji');
// Noto file names carry an `emoji_u` prefix inside the set directory.
const NOTO_BASE = `${emojiBase('noto')}emoji_u`;
const OPENMOJI_BASE = emojiBase('openmoji');

export const EMOJI_PROVIDERS: EmojiProvider[] = [
  {
    id: 'twemoji',
    name: 'Twemoji',
    description: 'The open-source Twitter/X emoji set. Flat, bright, and consistent across every platform.',
    // Twemoji drops U+FE0F from file names unless the sequence contains a ZWJ.
    imageUrl: (e) => `${TWEMOJI_BASE}${codepoints(e, '-', { stripVS16: 'unlessZwj' })}.svg`,
  },
  {
    id: 'noto',
    name: 'Noto Color Emoji',
    description: "Google's emoji, as seen on Android and Chrome OS.",
    // Noto never includes U+FE0F in file names.
    imageUrl: (e) => `${NOTO_BASE}${codepoints(e, '_', { stripVS16: 'always' })}.svg`,
  },
  {
    id: 'openmoji',
    name: 'OpenMoji',
    description: 'Community-drawn outlined style with a hand-made feel.',
    imageUrl: (e) => `${OPENMOJI_BASE}${codepoints(e, '-', { stripVS16: 'unlessZwj' }).toUpperCase()}.svg`,
  },
  {
    id: 'native',
    name: 'System',
    description: 'Whatever your operating system draws. Fastest, but looks different per device.',
    imageUrl: null,
  },
];

/**
 * Licences for the bundled artwork. Twemoji and OpenMoji are CC-BY / CC-BY-SA and *require*
 * visible attribution; Noto (Apache-2.0) requires the licence notice be preserved, which the
 * seeded LICENSE files and CREDITS.md do. Keep this in step with the versions the nebula
 * fetch script pins.
 */
export const EMOJI_ATTRIBUTIONS: EmojiAttribution[] = [
  {
    id: 'twemoji',
    name: 'Twemoji',
    license: 'CC-BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://github.com/jdecked/twemoji',
  },
  {
    id: 'noto',
    name: 'Noto Emoji',
    license: 'Apache-2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    sourceUrl: 'https://github.com/googlefonts/noto-emoji',
  },
  {
    id: 'openmoji',
    name: 'OpenMoji',
    license: 'CC-BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://openmoji.org',
  },
];

export const DEFAULT_EMOJI_PROVIDER: EmojiProviderId = 'twemoji';

export function getEmojiProvider(id: string | undefined): EmojiProvider {
  return EMOJI_PROVIDERS.find((p) => p.id === id) ?? EMOJI_PROVIDERS[0]!;
}

export function isEmojiProviderId(v: unknown): v is EmojiProviderId {
  return typeof v === 'string' && EMOJI_PROVIDERS.some((p) => p.id === v);
}
