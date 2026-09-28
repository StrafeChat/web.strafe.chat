/**
 * Emoji image providers. Each turns an emoji sequence into an image URL (or, for the
 * native provider, opts out so the OS font renders it). All image sets are served from
 * jsDelivr, which mirrors the projects' own GitHub/npm releases.
 */
export type EmojiProviderId = 'twemoji' | 'noto' | 'openmoji' | 'fluent' | 'native';

export interface EmojiProvider {
  id: EmojiProviderId;
  name: string;
  description: string;
  /** null = render the emoji as text with the system font. */
  imageUrl: ((emoji: string) => string) | null;
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

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/';
const NOTO_BASE = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u';
const OPENMOJI_BASE = 'https://cdn.jsdelivr.net/npm/openmoji@15.1.0/color/svg/';
const FLUENT_BASE = 'https://cdn.jsdelivr.net/npm/fluentui-emoji@1.1.1/icons/modern/';

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
    id: 'fluent',
    name: 'Fluent (3D)',
    description: "Microsoft's rounded 3D-style emoji.",
    imageUrl: (e) => `${FLUENT_BASE}${codepoints(e, '-', { stripVS16: 'unlessZwj' })}.svg`,
  },
  {
    id: 'native',
    name: 'System',
    description: 'Whatever your operating system draws. Fastest, but looks different per device.',
    imageUrl: null,
  },
];

export const DEFAULT_EMOJI_PROVIDER: EmojiProviderId = 'twemoji';

export function getEmojiProvider(id: string | undefined): EmojiProvider {
  return EMOJI_PROVIDERS.find((p) => p.id === id) ?? EMOJI_PROVIDERS[0]!;
}

export function isEmojiProviderId(v: unknown): v is EmojiProviderId {
  return typeof v === 'string' && EMOJI_PROVIDERS.some((p) => p.id === v);
}
