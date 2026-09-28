/**
 * Composer-side mention model.
 *
 * The draft the user types stays human-readable - `@username`, `@Role name`, `#channel`,
 * `@everyone` - and is only turned into the wire syntax the server and renderer understand
 * (`<@id>`, `<@&id>`, `<#id>`) at send time. Keeping the draft as plain text is what lets the
 * composer draw a styled overlay on top of a transparent textarea: both layers contain the
 * exact same characters, so they stay pixel-aligned.
 */
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole, SpaceRoom } from '../../api/spaces';
import type { CustomEmoji } from '../../api/emojis';
import { spaceRoleColorHex } from '../spacePermissions';
import { emojiCatalogIfLoaded } from '../emoji/data';

export interface MentionCatalog {
  users: { id: string; username: string; displayName: string }[];
  roles: { id: string; name: string; colorHex: string }[];
  channels: { id: string; name: string }[];
  /** Custom emoji the composer may reference as :name: (serialized to <:name:id>). */
  emojis: { id: string; name: string; animated: boolean }[];
}

export const EMPTY_CATALOG: MentionCatalog = { users: [], roles: [], channels: [], emojis: [] };

const EVERYONE_ROLE_NAME = '@everyone';
const ROOM_TYPE_TEXT = 3;

export function buildMentionCatalog(opts: {
  participants?: RoomParticipant[];
  roles?: SpaceRole[];
  channels?: SpaceRoom[];
  emojis?: CustomEmoji[];
}): MentionCatalog {
  return {
    users: (opts.participants ?? [])
      .filter((p) => p.username)
      .map((p) => ({ id: p.id, username: p.username, displayName: p.display_name || p.username })),
    roles: (opts.roles ?? [])
      .filter((r) => r.name && r.name !== EVERYONE_ROLE_NAME)
      .map((r) => ({ id: r.id, name: r.name, colorHex: spaceRoleColorHex(r.color) })),
    channels: (opts.channels ?? [])
      .filter((r) => r.type === ROOM_TYPE_TEXT && r.name)
      .map((r) => ({ id: r.id, name: r.name })),
    emojis: (opts.emojis ?? []).map((e) => ({ id: e.id, name: e.name, animated: e.animated })),
  };
}

export type DraftTokenKind =
  | 'text'
  | 'user'
  | 'role'
  | 'channel'
  | 'everyone'
  | 'emoji'
  | 'marker'
  | 'bold'
  | 'italic'
  | 'code'
  | 'url';

export interface DraftToken {
  kind: DraftTokenKind;
  /** Exact substring of the draft - the overlay must render every character verbatim. */
  text: string;
  /** Resolved entity id for user/role/channel/custom-emoji tokens. */
  id?: string;
  /** Role color for role tokens. */
  colorHex?: string;
  /** `name` = typed as @name/#name/:name: (needs serializing); `literal` = already wire
   * syntax; `shortcode` = a Unicode emoji typed as :shortcode: (becomes the emoji itself). */
  source?: 'name' | 'literal' | 'shortcode';
  /** Custom emoji: canonical name and whether it's animated. */
  name?: string;
  animated?: boolean;
  /** Unicode emoji for `shortcode` tokens. */
  unicode?: string;
}

const BARE_URL = /^(?:https?:\/\/[^\s\])<>"]+|www\.[^\s\])<>"]+)/i;
const SHORTCODE = /^:([A-Za-z0-9_+-]{2,32}):/;
const CUSTOM_EMOJI_LITERAL = /^<(a?):([A-Za-z0-9_]{2,32}):(\d+)>/;

function isWordChar(c: string | undefined): boolean {
  return c != null && /[\p{L}\p{N}_]/u.test(c);
}

function boundaryBefore(text: string, i: number): boolean {
  return i === 0 || !isWordChar(text[i - 1]);
}

function boundaryAfter(text: string, end: number): boolean {
  return end >= text.length || !isWordChar(text[end]);
}

/** Longest-first so "@Space Mods" wins over a role literally named "Space". */
function byLengthDesc<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.name.length - a.name.length);
}

function matchNamed<T extends { name: string }>(text: string, from: number, list: T[]): T | null {
  for (const item of list) {
    const end = from + item.name.length;
    if (text.startsWith(item.name, from) && boundaryAfter(text, end)) return item;
  }
  return null;
}

/**
 * Scan a draft into styled tokens. Concatenating `token.text` over the result always
 * reproduces the input exactly.
 */
export function tokenizeDraft(text: string, catalog: MentionCatalog = EMPTY_CATALOG): DraftToken[] {
  const out: DraftToken[] = [];
  const len = text.length;
  const users = [...catalog.users]
    .map((u) => ({ ...u, name: u.username }))
    .sort((a, b) => b.name.length - a.name.length);
  const roles = byLengthDesc(catalog.roles);
  const channels = byLengthDesc(catalog.channels);
  let i = 0;
  let plainStart = 0;

  const flushPlain = (upTo: number) => {
    if (upTo > plainStart) out.push({ kind: 'text', text: text.slice(plainStart, upTo) });
  };
  const push = (tok: DraftToken) => {
    flushPlain(i);
    out.push(tok);
    i += tok.text.length;
    plainStart = i;
  };

  while (i < len) {
    const c = text[i]!;
    const rest = text.slice(i);

    if (c === '`') {
      const block = rest.match(/^```[\s\S]*?```/);
      if (block) {
        push({ kind: 'code', text: block[0] });
        continue;
      }
      const inline = rest.match(/^`[^`\n]+`/);
      if (inline) {
        push({ kind: 'code', text: inline[0] });
        continue;
      }
    }

    if (c === '<') {
      const custom = rest.match(CUSTOM_EMOJI_LITERAL);
      if (custom) {
        push({ kind: 'emoji', text: custom[0], id: custom[3], name: custom[2], animated: custom[1] === 'a', source: 'literal' });
        continue;
      }
      const role = rest.match(/^<@&(\d+)>/);
      if (role) {
        push({ kind: 'role', text: role[0], id: role[1], source: 'literal' });
        continue;
      }
      const user = rest.match(/^<@!?(\d+)>/);
      if (user) {
        push({ kind: 'user', text: user[0], id: user[1], source: 'literal' });
        continue;
      }
      const channel = rest.match(/^<#(\d+)>/);
      if (channel) {
        push({ kind: 'channel', text: channel[0], id: channel[1], source: 'literal' });
        continue;
      }
    }

    if (c === '@' && boundaryBefore(text, i)) {
      const everyone = rest.match(/^@(everyone|here)(?![\p{L}\p{N}_])/u);
      if (everyone) {
        push({ kind: 'everyone', text: everyone[0] });
        continue;
      }
      const u = matchNamed(text, i + 1, users);
      if (u) {
        push({ kind: 'user', text: `@${u.name}`, id: u.id, source: 'name' });
        continue;
      }
      const r = matchNamed(text, i + 1, roles);
      if (r) {
        push({ kind: 'role', text: `@${r.name}`, id: r.id, colorHex: r.colorHex, source: 'name' });
        continue;
      }
    }

    if (c === '#' && boundaryBefore(text, i)) {
      const ch = matchNamed(text, i + 1, channels);
      if (ch) {
        push({ kind: 'channel', text: `#${ch.name}`, id: ch.id, source: 'name' });
        continue;
      }
    }

    // :name: - a custom emoji from one of the user's spaces, or a Unicode shortcode.
    // Only *known* names become tokens, so "10:30:45" stays plain text.
    if (c === ':') {
      const sc = rest.match(SHORTCODE);
      if (sc) {
        const typed = sc[1]!;
        const custom = catalog.emojis.find((e) => e.name.toLowerCase() === typed.toLowerCase());
        if (custom) {
          push({ kind: 'emoji', text: sc[0], id: custom.id, name: custom.name, animated: custom.animated, source: 'name' });
          continue;
        }
        const entry = emojiCatalogIfLoaded()?.byShortcode.get(typed.toLowerCase());
        if (entry) {
          push({ kind: 'emoji', text: sc[0], unicode: entry.unicode, source: 'shortcode' });
          continue;
        }
      }
    }

    if ((c === 'h' || c === 'H' || c === 'w' || c === 'W') && boundaryBefore(text, i)) {
      const url = rest.match(BARE_URL);
      if (url) {
        push({ kind: 'url', text: url[0] });
        continue;
      }
    }

    if (c === '*' || c === '_') {
      const bold = rest.match(/^\*\*([^*\n]+)\*\*/) ?? rest.match(/^__([^_\n]+)__/);
      if (bold) {
        const mark = bold[0].slice(0, 2);
        flushPlain(i);
        out.push({ kind: 'marker', text: mark });
        out.push({ kind: 'bold', text: bold[1]! });
        out.push({ kind: 'marker', text: mark });
        i += bold[0].length;
        plainStart = i;
        continue;
      }
      const italic = rest.match(/^\*([^*\n]+)\*/) ?? rest.match(/^_([^_\n]+)_/);
      if (italic) {
        const mark = italic[0].slice(0, 1);
        flushPlain(i);
        out.push({ kind: 'marker', text: mark });
        out.push({ kind: 'italic', text: italic[1]! });
        out.push({ kind: 'marker', text: mark });
        i += italic[0].length;
        plainStart = i;
        continue;
      }
    }

    i += 1;
  }
  flushPlain(len);
  return out;
}

/** Turn a human-readable draft into wire syntax. Code spans are left untouched. */
export function serializeDraft(text: string, catalog: MentionCatalog = EMPTY_CATALOG): string {
  return tokenizeDraft(text, catalog)
    .map((t) => {
      if (t.kind === 'emoji') {
        if (t.source === 'shortcode' && t.unicode) return t.unicode;
        if (t.source === 'name' && t.id) return `<${t.animated ? 'a' : ''}:${t.name ?? t.text.slice(1, -1)}:${t.id}>`;
        return t.text;
      }
      if (t.source !== 'name' || !t.id) return t.text;
      if (t.kind === 'user') return `<@${t.id}>`;
      if (t.kind === 'role') return `<@&${t.id}>`;
      if (t.kind === 'channel') return `<#${t.id}>`;
      return t.text;
    })
    .join('');
}
