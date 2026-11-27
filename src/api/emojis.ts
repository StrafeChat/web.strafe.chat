import { api } from './client';

/** A space's custom emoji. Used in text as `<:name:id>` (`<a:name:id>` when animated). */
export interface CustomEmoji {
  id: string;
  space_id: string;
  name: string;
  url: string;
  animated: boolean;
  creator_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const EMOJI_MAX_BYTES = 512 * 1024;
export const EMOJIS_PER_SPACE = 50;
/** The most images one `POST /spaces/:id/emojis/bulk` takes (equinox MaxEmojiBulkFiles). */
export const EMOJI_BULK_MAX_FILES = 10;

export function listSpaceEmojis(spaceId: string) {
  return api<CustomEmoji[]>(`/spaces/${spaceId}/emojis`);
}

/** Every custom emoji from every space the current user is in. */
export function listMyEmojis() {
  return api<CustomEmoji[]>('/emojis');
}

/** Resolve an emoji seen in a message from a space the viewer may not be in. */
export function lookupEmoji(emojiId: string) {
  return api<CustomEmoji>(`/emojis/${emojiId}`);
}

export function uploadSpaceEmoji(spaceId: string, file: File, name: string) {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('name', name);
  return api<CustomEmoji>(`/spaces/${spaceId}/emojis`, { method: 'POST', body: form });
}

/** One item's outcome in a bulk upload, in request order: `emoji` when created, else `error`. */
export interface BulkEmojiResult {
  index: number;
  name: string;
  status: number;
  emoji?: CustomEmoji;
  error?: string;
}

/**
 * Upload up to EMOJI_BULK_MAX_FILES emoji in one request. One refusal never fails the rest:
 * the answer lists a result per item. Only a refusal of the whole request (permission, a
 * malformed form, the rate limit) throws.
 */
export function uploadSpaceEmojisBulk(spaceId: string, items: { file: File; name: string }[]) {
  const form = new FormData();
  for (const item of items) form.append('file', item.file, item.file.name);
  for (const item of items) form.append('name', item.name);
  return api<{ created: number; results: BulkEmojiResult[] }>(`/spaces/${spaceId}/emojis/bulk`, { method: 'POST', body: form });
}

export function renameSpaceEmoji(spaceId: string, emojiId: string, name: string) {
  return api<CustomEmoji>(`/spaces/${spaceId}/emojis/${emojiId}`, { method: 'PATCH', json: { name } });
}

export function deleteSpaceEmoji(spaceId: string, emojiId: string) {
  return api<void>(`/spaces/${spaceId}/emojis/${emojiId}`, { method: 'DELETE' });
}
