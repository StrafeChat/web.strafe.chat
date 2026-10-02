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
  /** Extra names this entry is also findable by, beyond the dataset's own shortcodes. */
  aliases?: string[];
}

export interface EmojiGroup {
  id: number;
  key: string;
  label: string;
  icon: string;
}

/**
 * Display order/labels for emojibase group ids. Its "component" group (2) is skipped - skin
 * tones and hair are modifiers, not standalone emoji - but every other id is listed.
 */
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

/**
 * Where an emoji with no group of its own belongs.
 *
 * emojibase-data ships the 26 regional indicator letters (🇦…🇿, the building blocks every
 * country flag is made of) with no `group` at all, because CLDR has no category for "a letter
 * on its own" - they only appear as part of a flag. Filtering on `group == null` therefore
 * deleted all 26, which is why the picker had no letter emoji and `:regional_indicator_a:`
 * never resolved even though the dataset ships a shortcode for it. They go under Symbols,
 * where the single-letter ones belong and where a person looking for 🔤 will look.
 */
const GROUP_FALLBACK = 8;

/** Order for entries the dataset gives no `order` for. */
const ORDER_FALLBACK = 10_000;

/**
 * A second name for the regional indicator letters, so they can be found the way people
 * actually type them. The dataset's own shortcode is `regional_indicator_a`, which nobody
 * guesses; `flag_a` and a bare `a` are what someone reaching for a country flag types.
 *
 * The bare letter is deliberately last in the array: `searchEmoji` ranks prefixes in order, so
 * a one-character alias matching first would put every letter at the top of every search.
 */
function regionalIndicatorAliases(label: string): string[] | undefined {
  const letter = /^regional indicator ([A-Z])$/.exec(label)?.[1];
  if (!letter) return undefined;
  return [`flag_${letter.toLowerCase()}`, `letter_${letter.toLowerCase()}`];
}

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
        // Components (skin tones, hair) are modifiers reached through their base emoji, not
        // things to pick on their own. Everything else is kept, including entries with no
        // group of their own - see GROUP_FALLBACK for why those are 26 real emoji.
        if (e.group === 2) continue;
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
          group: e.group ?? GROUP_FALLBACK,
          order: e.order ?? ORDER_FALLBACK,
          skins: e.skins?.length ? e.skins.map((s) => s.unicode) : undefined,
          aliases: regionalIndicatorAliases(e.label),
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
      // Aliases go in last so a real shortcode always wins a collision.
      for (const e of all) {
        for (const a of e.aliases ?? []) if (!byShortcode.has(a)) byShortcode.set(a, e);
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

/**
 * Rank matches: a shortcode that starts with the query first (in the query's own order, so
 * typing more of a shortcode narrows it), then label, tag and substring hits.
 *
 * The whole catalogue is scanned on every keystroke - the old early exit once `limit` prefix
 * hits had piled up stopped the scan partway, which silently dropped everything later in the
 * dataset. Nineteen hundred entries is nothing to walk, and it means the result stops
 * depending on where a match happens to sit in the ordering.
 */
export function searchEmoji(catalog: EmojiCatalog, query: string, limit = 60): EmojiEntry[] {
  const q = query.trim().toLowerCase().replace(/^:/, '').replace(/:$/, '');
  if (!q) return [];
  const prefix: EmojiEntry[] = [];
  const contains: EmojiEntry[] = [];
  for (const e of catalog.all) {
    const names = e.aliases ? [...e.shortcodes, ...e.aliases] : e.shortcodes;
    if (names.some((c) => c.startsWith(q))) prefix.push(e);
    else if (e.label.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q)) || names.some((c) => c.includes(q))) {
      contains.push(e);
    }
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
