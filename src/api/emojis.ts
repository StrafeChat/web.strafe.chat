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

export function renameSpaceEmoji(spaceId: string, emojiId: string, name: string) {
  return api<CustomEmoji>(`/spaces/${spaceId}/emojis/${emojiId}`, { method: 'PATCH', json: { name } });
}

export function deleteSpaceEmoji(spaceId: string, emojiId: string) {
  return api<void>(`/spaces/${spaceId}/emojis/${emojiId}`, { method: 'DELETE' });
}
