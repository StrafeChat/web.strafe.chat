/**
 * Message search: Discord-style `from:` / `in:` / `has:` / `mentions:` operators.
 *
 * Space channels are searched server-side across the whole space
 * (GET /spaces/:id/messages/search); a single conversation is searched with
 * GET /rooms/:id/messages/search. Either endpoint can decline: an E2EE room reports
 * `searchable: false` and a space's E2EE channels are simply skipped, because the server
 * only ever holds their ciphertext. For those we fall back to scanning the history this
 * device has already decrypted, and the panel says so.
 */

import {
  searchMessages as searchMessagesApi,
  searchSpaceMessages as searchSpaceMessagesApi,
  type Attachment,
  type Message,
} from '../api/messages';
import { messages, loadOlderMessages, viewFromServerAttachment, type DecryptedMessage } from '../stores/messages';
import { compareMessageIds } from '../stores/readState';
import { getMessageBodyText } from '../components/messageList/utils';

export type SearchHasFilter = 'link' | 'image' | 'video' | 'audio' | 'file';

export const HAS_VALUES: SearchHasFilter[] = ['link', 'image', 'video', 'audio', 'file'];

export interface ParsedSearchQuery {
  /** Free text remaining after operator tokens are stripped out. */
  text: string;
  /** Resolved user id for `from:`, if the token matched a known participant/member. */
  from?: string;
  mentions?: string;
  has?: SearchHasFilter;
  /** Resolved room id for `in:` (space search only). */
  in?: string;
}

export interface SearchIdentity {
  id: string;
  username: string;
  display_name?: string;
}

export interface SearchChannel {
  id: string;
  name?: string;
}

/** Everything the operators can resolve names against. */
export interface SearchCatalog {
  people?: SearchIdentity[];
  channels?: SearchChannel[];
}

const TOKEN_RE = /(?:^|\s)(from|in|has|mentions):(\S+)/gi;

function resolveUser(token: string, people: SearchIdentity[]): string {
  const clean = token.replace(/^@/, '');
  const hit = people.find((p) => p.id === clean || p.username.toLowerCase() === clean.toLowerCase());
  return hit?.id ?? clean;
}

function resolveChannel(token: string, channels: SearchChannel[]): string {
  const clean = token.replace(/^#/, '');
  const hit = channels.find((c) => c.id === clean || (c.name ?? '').toLowerCase() === clean.toLowerCase());
  return hit?.id ?? clean;
}

/** Pulls the operator tokens out of the raw search box text. Unknown `has:` values are
 * ignored (left as plain text) rather than silently dropped. */
export function parseSearchQuery(raw: string, catalog: SearchCatalog = {}): ParsedSearchQuery {
  const people = catalog.people ?? [];
  const channels = catalog.channels ?? [];
  const out: ParsedSearchQuery = { text: raw };
  let text = raw;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(raw))) {
    const key = m[1]!.toLowerCase();
    const value = m[2]!;
    if (key === 'has') {
      if ((HAS_VALUES as string[]).includes(value.toLowerCase())) {
        out.has = value.toLowerCase() as SearchHasFilter;
        text = text.replace(m[0], ' ');
      }
      continue;
    }
    if (key === 'in') {
      out.in = resolveChannel(value, channels);
      text = text.replace(m[0], ' ');
      continue;
    }
    const resolved = resolveUser(value, people);
    if (key === 'from') out.from = resolved;
    else out.mentions = resolved;
    text = text.replace(m[0], ' ');
  }
  out.text = text.replace(/\s+/g, ' ').trim();
  return out;
}

export function isEmptyQuery(q: ParsedSearchQuery): boolean {
  return !q.text && !q.from && !q.mentions && !q.has && !q.in;
}

export type SearchFilterKey = 'from' | 'in' | 'has' | 'mentions';

/** The `key:value` token the caret currently sits in, if any - what the suggestion
 * dropdown narrows itself to while you are filling one in. */
export interface ActiveFilterToken {
  key: SearchFilterKey;
  /** What has been typed after the colon so far (may be empty). */
  value: string;
  /** Index in the raw text where `key:` starts, so a picked suggestion can replace it. */
  start: number;
}

const ACTIVE_TOKEN_RE = /(?:^|\s)(from|in|has|mentions):(\S*)$/i;

export function activeFilterToken(raw: string, caret: number): ActiveFilterToken | null {
  const head = raw.slice(0, caret);
  const m = ACTIVE_TOKEN_RE.exec(head);
  if (!m) return null;
  const key = m[1]!.toLowerCase() as SearchFilterKey;
  const value = m[2]!;
  return { key, value, start: head.length - m[0].trimStart().length };
}

/** Replaces the token the caret is in with `key:value`, leaving the rest of the query
 * alone; used when a suggestion is picked. */
export function applyFilterToken(raw: string, token: ActiveFilterToken | null, key: SearchFilterKey, value: string): string {
  const insert = `${key}:${value} `;
  if (token) {
    const after = raw.slice(token.start + token.key.length + 1 + token.value.length);
    return raw.slice(0, token.start) + insert + after.replace(/^\s+/, '');
  }
  const base = raw.length === 0 || /\s$/.test(raw) ? raw : `${raw} `;
  return base + insert;
}

export interface SearchMatch {
  /** Which room this hit is in - a space search spans every readable channel. */
  roomId: string;
  /** Ready to render with the same components the message list uses. */
  message: DecryptedMessage;
}

export interface SearchOutcome {
  matches: SearchMatch[];
  hasMore: boolean;
  /** Pass as `before` to continue when hasMore is true. */
  nextBefore?: string;
  /** True when results came from locally decrypted history (E2EE room, or the server
   * request failed) rather than a full server-side scan. */
  localOnly: boolean;
  /** Space search: how many channels were skipped for being E2EE. */
  encryptedRooms?: number;
}

export const SEARCH_PAGE_SIZE = 25;
// Local (E2EE) search pages history backward looking for matches - bounded so a query with
// no hits in a huge room can't page forever. 25 rounds * ~30/page ≈ 750 messages scanned.
const LOCAL_SEARCH_MAX_ROUNDS = 25;

function decryptedFromServer(m: Message): DecryptedMessage {
  return {
    ...m,
    plaintext: m.plaintext ?? '',
    notEncrypted: true,
    attachments: ((m.attachments ?? []) as Attachment[]).filter((a) => !a.encrypted).map(viewFromServerAttachment),
  };
}

function toMatches(list: Message[], fallbackRoomId: string): SearchMatch[] {
  return list.map((m) => ({ roomId: m.room_id || fallbackRoomId, message: decryptedFromServer(m) }));
}

function localPredicate(query: ParsedSearchQuery, q: string) {
  return (m: DecryptedMessage): boolean => {
    if (m.system_type || m.id.startsWith('temp-')) return false;
    if (query.from && m.sender_id !== query.from) return false;
    if (query.mentions && !(m.mentions ?? []).includes(query.mentions)) return false;
    if (query.has) {
      const atts = m.attachments ?? [];
      if (query.has === 'file') {
        if (atts.length === 0) return false;
      } else if (query.has === 'link') {
        if (!/https?:\/\//.test(getMessageBodyText(m))) return false;
      } else if (!atts.some((a) => a.contentType?.startsWith(`${query.has}/`))) {
        return false;
      }
    }
    if (q && !getMessageBodyText(m).toLowerCase().includes(q)) return false;
    return true;
  };
}

async function searchLocalHistory(roomId: string, query: ParsedSearchQuery, q: string): Promise<SearchOutcome> {
  const predicate = localPredicate(query, q);
  let list = messages.byRoom[roomId] ?? [];
  let match = list.filter(predicate);
  let rounds = 0;
  while (
    match.length < SEARCH_PAGE_SIZE &&
    messages.hasMoreOlder[roomId] !== false &&
    rounds < LOCAL_SEARCH_MAX_ROUNDS
  ) {
    const got = await loadOlderMessages(roomId);
    if (!got) break;
    list = messages.byRoom[roomId] ?? [];
    match = list.filter(predicate);
    rounds++;
  }
  return {
    matches: match
      .slice()
      .reverse()
      .slice(0, SEARCH_PAGE_SIZE)
      .map((m) => ({ roomId, message: m })),
    hasMore: false,
    localOnly: true,
  };
}

/** Searches one conversation (PM, group PM, or a single space channel). `before` continues
 * a previous server-backed page - local (E2EE) search always returns everything it found in
 * one pass, so `before` is ignored for it. */
export async function searchRoomMessages(
  roomId: string,
  query: ParsedSearchQuery,
  before?: string
): Promise<SearchOutcome> {
  const q = query.text.toLowerCase();
  try {
    const res = await searchMessagesApi(roomId, {
      q: query.text || undefined,
      from: query.from,
      mentions: query.mentions,
      has: query.has,
      before,
      limit: SEARCH_PAGE_SIZE,
    });
    if (res.searchable) {
      return {
        matches: toMatches(res.messages, roomId),
        hasMore: !!res.next_before_id,
        nextBefore: res.next_before_id,
        localOnly: false,
      };
    }
  } catch (err) {
    console.warn('[search] server search failed, falling back to local history:', err);
  }
  return searchLocalHistory(roomId, query, q);
}

/**
 * Searches every text channel of a space the caller can read; `in:` narrows it to one.
 *
 * `localRoomId` is the channel the user is currently looking at when that channel is
 * E2EE: the server skipped it, so its locally decrypted history is searched here and
 * merged in, rather than the user getting zero hits for the very channel they are reading.
 * Only done for the first page, since local search isn't paginated.
 */
export async function searchSpaceMessages(
  spaceId: string,
  query: ParsedSearchQuery,
  before?: string,
  localRoomId?: string
): Promise<SearchOutcome> {
  const res = await searchSpaceMessagesApi(spaceId, {
    q: query.text || undefined,
    from: query.from,
    mentions: query.mentions,
    has: query.has,
    in: query.in,
    before,
    limit: SEARCH_PAGE_SIZE,
  });
  let matches = toMatches(res.messages, query.in ?? '');
  let localOnly = false;
  let encryptedRooms = res.encrypted_rooms;
  if (localRoomId && !before && (!query.in || query.in === localRoomId)) {
    const local = await searchLocalHistory(localRoomId, query, query.text.toLowerCase());
    // Flagged even when it found nothing: the caveat is about coverage, not about hits.
    localOnly = true;
    // This channel wasn't really skipped - it was searched here instead, so don't count
    // it among the ones the reader is told were left out.
    if (encryptedRooms > 0) encryptedRooms -= 1;
    if (local.matches.length > 0) {
      const seen = new Set(matches.map((m) => m.message.id));
      matches = matches
        .concat(local.matches.filter((m) => !seen.has(m.message.id)))
        .sort((a, b) => compareMessageIds(b.message.id, a.message.id))
        .slice(0, SEARCH_PAGE_SIZE);
    }
  }
  return {
    matches,
    hasMore: !!res.next_before_id,
    nextBefore: res.next_before_id,
    localOnly,
    encryptedRooms,
  };
}
