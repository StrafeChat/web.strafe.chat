import { createStore, produce } from 'solid-js/store';
import { listMyEmojis, lookupEmoji, type CustomEmoji } from '../api/emojis';
import { onStargateEvent } from '../services/stargate/client';
import { stargateEventInnerRecord } from './spaceSync';

/**
 * Custom emoji from every space the user is in (for the picker and `:name:` completion),
 * plus a by-id cache that also holds emoji resolved on demand from spaces the user is
 * *not* in - anyone can use their spaces' emoji anywhere, so a PM can legitimately
 * contain an emoji the reader has never seen.
 */
export interface CustomEmojiState {
  bySpaceId: Record<string, CustomEmoji[]>;
  byId: Record<string, CustomEmoji>;
  /** Ids we asked the server about and that don't exist (deleted) - don't retry. */
  missing: Record<string, true>;
  loaded: boolean;
}

export const [customEmojis, setCustomEmojis] = createStore<CustomEmojiState>({
  bySpaceId: {},
  byId: {},
  missing: {},
  loaded: false,
});

export async function loadCustomEmojis(): Promise<void> {
  try {
    const list = await listMyEmojis();
    const bySpaceId: Record<string, CustomEmoji[]> = {};
    for (const e of list) (bySpaceId[e.space_id] ??= []).push(e);
    for (const l of Object.values(bySpaceId)) l.sort((a, b) => a.name.localeCompare(b.name));
    setCustomEmojis((prev) => ({
      ...prev,
      bySpaceId,
      byId: { ...prev.byId, ...Object.fromEntries(list.map((e) => [e.id, e])) },
      loaded: true,
    }));
  } catch (e) {
    console.warn('[emoji] failed to load custom emoji', e);
    setCustomEmojis('loaded', true);
  }
}

export function clearCustomEmojis(): void {
  setCustomEmojis({ bySpaceId: {}, byId: {}, missing: {}, loaded: false });
}

/** Every usable custom emoji, alphabetical within each space. */
export function allCustomEmojis(): CustomEmoji[] {
  return Object.values(customEmojis.bySpaceId).flat();
}

const pendingLookups = new Set<string>();

/**
 * Reactive resolution of an emoji id. Returns immediately from cache; for an unknown id
 * it kicks off one lookup and returns undefined until the store updates (callers that
 * read this inside a tracking scope re-render when it lands).
 */
export function resolveCustomEmoji(id: string): CustomEmoji | undefined {
  const hit = customEmojis.byId[id];
  if (hit) return hit;
  if (customEmojis.missing[id] || pendingLookups.has(id) || !/^\d+$/.test(id)) return undefined;
  pendingLookups.add(id);
  lookupEmoji(id)
    .then((e) => setCustomEmojis('byId', id, e))
    .catch(() => setCustomEmojis('missing', id, true))
    .finally(() => pendingLookups.delete(id));
  return undefined;
}

function upsert(e: CustomEmoji) {
  setCustomEmojis('byId', e.id, e);
  setCustomEmojis('bySpaceId', e.space_id, (list) => {
    const next = (list ?? []).filter((x) => x.id !== e.id);
    next.push(e);
    next.sort((a, b) => a.name.localeCompare(b.name));
    return next;
  });
}

function emojiFromPayload(d: Record<string, unknown>): CustomEmoji | null {
  const id = d.id != null ? String(d.id) : null;
  const spaceId = d.space_id != null ? String(d.space_id) : null;
  if (!id || !spaceId || typeof d.name !== 'string' || typeof d.url !== 'string') return null;
  return {
    id,
    space_id: spaceId,
    name: d.name,
    url: d.url,
    animated: d.animated === true,
    ...(d.creator_id != null ? { creator_id: String(d.creator_id) } : {}),
    ...(d.created_at != null ? { created_at: String(d.created_at) } : {}),
  };
}

/** SPACE_EMOJI_* keep the cache live; SPACE_LEAVE drops that space's set from the picker. */
export function initCustomEmojiHandlers(): () => void {
  return onStargateEvent((event) => {
    const t = event.t;
    if (t !== 'SPACE_EMOJI_CREATE' && t !== 'SPACE_EMOJI_UPDATE' && t !== 'SPACE_EMOJI_DELETE' && t !== 'SPACE_LEAVE') return;
    const d = stargateEventInnerRecord(event);
    if (!d) return;
    const spaceId = d.space_id != null ? String(d.space_id) : null;
    if (!spaceId) return;
    if (t === 'SPACE_LEAVE') {
      // `produce`, not a spread copy: a store setter handed a plain object *merges* it, so
      // "everything except this key" quietly leaves the key in place.
      setCustomEmojis(
        produce((s) => {
          delete s.bySpaceId[spaceId];
        })
      );
      return;
    }
    if (t === 'SPACE_EMOJI_DELETE') {
      const emojiId = d.emoji_id != null ? String(d.emoji_id) : null;
      if (!emojiId) return;
      setCustomEmojis('bySpaceId', spaceId, (list) => (list ?? []).filter((x) => x.id !== emojiId));
      setCustomEmojis(
        produce((s) => {
          delete s.byId[emojiId];
        })
      );
      setCustomEmojis('missing', emojiId, true);
      return;
    }
    const e = emojiFromPayload(d);
    if (e) upsert(e);
  });
}
