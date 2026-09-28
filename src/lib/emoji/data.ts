/**
 * Unicode emoji catalogue for the picker and `:shortcode:` completion. Backed by
 * emojibase-data (CLDR names, keywords, groups, skin-tone variants) and loaded lazily on
 * first use - it's ~700 KB of JSON that most sessions never need until the picker opens.
 */
export interface EmojiEntry {
  /** The emoji as it should be inserted into text (emojibase's `unicode`, VS16 included). */
  unicode: string;
  hexcode: string;
  label: string;
  /** Primary shortcode (no colons), e.g. "thumbs_up". */
  shortcode: string;
  /** Every shortcode alias, primary first. */
  shortcodes: string[];
  tags: string[];
  group: number;
  order: number;
  /** Skin-tone variants in tone order 1..5 (light → dark); each is a full sequence. */
  skins?: string[];
}

export interface EmojiGroup {
  id: number;
  key: string;
  label: string;
  icon: string;
}

/** Display order/labels for emojibase group ids (its "component" group is skipped). */
export const EMOJI_GROUPS: EmojiGroup[] = [
  { id: 0, key: 'smileys', label: 'Smileys & emotion', icon: 'fa-face-smile' },
  { id: 1, key: 'people', label: 'People & body', icon: 'fa-hand' },
  { id: 3, key: 'nature', label: 'Animals & nature', icon: 'fa-leaf' },
  { id: 4, key: 'food', label: 'Food & drink', icon: 'fa-mug-hot' },
  { id: 5, key: 'travel', label: 'Travel & places', icon: 'fa-plane' },
  { id: 6, key: 'activities', label: 'Activities', icon: 'fa-futbol' },
  { id: 7, key: 'objects', label: 'Objects', icon: 'fa-lightbulb' },
  { id: 8, key: 'symbols', label: 'Symbols', icon: 'fa-heart' },
  { id: 9, key: 'flags', label: 'Flags', icon: 'fa-flag' },
];

export interface EmojiCatalog {
  all: EmojiEntry[];
  byGroup: Map<number, EmojiEntry[]>;
  byShortcode: Map<string, EmojiEntry>;
  byUnicode: Map<string, EmojiEntry>;
}

let catalogPromise: Promise<EmojiCatalog> | null = null;
let catalogSync: EmojiCatalog | null = null;

interface CompactEmoji {
  hexcode: string;
  unicode: string;
  label: string;
  group?: number;
  order?: number;
  tags?: string[];
  skins?: CompactEmoji[];
}

export function loadEmojiCatalog(): Promise<EmojiCatalog> {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      import('emojibase-data/en/compact.json'),
      import('emojibase-data/en/shortcodes/emojibase.json'),
    ]).then(([dataMod, shortMod]) => {
      const data = (dataMod.default ?? dataMod) as unknown as CompactEmoji[];
      const shortcodes = (shortMod.default ?? shortMod) as unknown as Record<string, string | string[]>;
      const all: EmojiEntry[] = [];
      for (const e of data) {
        // Skip components (skin tones, hair) and anything without a group - they're not
        // standalone emoji.
        if (e.group == null || e.group === 2) continue;
        const raw = shortcodes[e.hexcode];
        const codes = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
        if (codes.length === 0) continue;
        all.push({
          unicode: e.unicode,
          hexcode: e.hexcode,
          label: e.label,
          shortcode: codes[0]!,
          shortcodes: codes,
          tags: e.tags ?? [],
          group: e.group,
          order: e.order ?? 0,
          skins: e.skins?.length ? e.skins.map((s) => s.unicode) : undefined,
        });
      }
      all.sort((a, b) => a.order - b.order);
      const byGroup = new Map<number, EmojiEntry[]>();
      const byShortcode = new Map<string, EmojiEntry>();
      const byUnicode = new Map<string, EmojiEntry>();
      for (const e of all) {
        const list = byGroup.get(e.group) ?? [];
        list.push(e);
        byGroup.set(e.group, list);
        for (const c of e.shortcodes) if (!byShortcode.has(c)) byShortcode.set(c, e);
        byUnicode.set(e.unicode, e);
        byUnicode.set(e.unicode.replace(/️/g, ''), e);
        for (const s of e.skins ?? []) byUnicode.set(s, e);
      }
      const catalog = { all, byGroup, byShortcode, byUnicode };
      catalogSync = catalog;
      return catalog;
    });
  }
  return catalogPromise;
}

/** The catalogue if it has already been loaded, else null (never triggers a load). */
export function emojiCatalogIfLoaded(): EmojiCatalog | null {
  return catalogSync;
}

/** Rank matches: shortcode prefix first, then label/tag substrings. */
export function searchEmoji(catalog: EmojiCatalog, query: string, limit = 60): EmojiEntry[] {
  const q = query.trim().toLowerCase().replace(/^:/, '').replace(/:$/, '');
  if (!q) return [];
  const prefix: EmojiEntry[] = [];
  const contains: EmojiEntry[] = [];
  for (const e of catalog.all) {
    if (e.shortcodes.some((c) => c.startsWith(q))) prefix.push(e);
    else if (e.label.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q)) || e.shortcodes.some((c) => c.includes(q))) {
      contains.push(e);
    }
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** Apply a skin tone (1..5) to an entry, falling back to the base emoji. */
export function withSkinTone(entry: EmojiEntry, tone: number): string {
  if (tone < 1 || tone > 5 || !entry.skins) return entry.unicode;
  return entry.skins[tone - 1] ?? entry.unicode;
}

/** Shortcode for an emoji sequence (base form), for tooltips. */
export function shortcodeFor(unicode: string): string | null {
  const c = catalogSync;
  if (!c) return null;
  const e = c.byUnicode.get(unicode) ?? c.byUnicode.get(unicode.replace(/️/g, ''));
  return e ? e.shortcode : null;
}

/** Skin tone modifiers, in picker order. */
export const SKIN_TONES: { tone: number; label: string; swatch: string }[] = [
  { tone: 0, label: 'Default', swatch: '#ffcc22' },
  { tone: 1, label: 'Light', swatch: '#f7dece' },
  { tone: 2, label: 'Medium-light', swatch: '#f3d2a2' },
  { tone: 3, label: 'Medium', swatch: '#d5ab88' },
  { tone: 4, label: 'Medium-dark', swatch: '#af7e57' },
  { tone: 5, label: 'Dark', swatch: '#7c533e' },
];
