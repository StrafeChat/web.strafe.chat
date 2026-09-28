import { api, getApiUrl, ApiError } from './client';

/**
 * A file attached to a message. In E2EE rooms the server-side copy only has id/url/size
 * (`encrypted: true`); the name, type, dimensions and AES key come from the decrypted
 * message body instead - see stores/messages.ts resolveAttachments.
 */
export interface Attachment {
  id: string;
  filename?: string;
  content_type?: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
  encrypted?: boolean;
}

/**
 * One emoji's aggregated state on a message. `emoji` is either a raw unicode emoji or
 * "custom:<id>" for a space's custom emoji - same key the add/remove endpoints take.
 */
export interface MessageReaction {
  emoji: string;
  count: number;
  /** Whether the requesting user is one of the reactors. */
  me: boolean;
}

/** A reactor's profile, as returned by GET .../reactions/:emoji. */
export interface Reactor {
  id: string;
  username: string;
  discriminator: number;
  display_name: string;
  avatar?: string;
}

export interface Message {
  room_id: string;
  id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string;
  /** Set when room has E2EE disabled (server-stored plaintext). */
  plaintext?: string;
  reply_to_id?: string;
  /** Direct user mentions. Non-E2EE rooms: server-parsed and authoritative. E2EE rooms: as declared at send time. */
  mentions?: string[];
  mention_everyone?: boolean;
  mention_roles?: string[];
  system_type?: string;
  system_payload?: string;
  attachments?: Attachment[];
  /** Only present when non-empty - omitted (not populated on MESSAGE_CREATE/UPDATE events,
   * which can't yet/don't change reactions) rather than sent as an empty array. */
  reactions?: MessageReaction[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CreateMessageInput {
  /** Snowflake string - never a JS number, which would round it. */
  sender_device_id: string;
  ciphertext?: string;
  plaintext?: string;
  /** Snowflake as a string - as a JS number it exceeds 2^53 and gets rounded in transit. */
  reply_to_id?: string;
  /** E2EE rooms only - the server can't read ciphertext, so the client declares who it's pinging. Ignored for non-E2EE rooms (server derives from plaintext instead). */
  mentions?: string[];
  mention_everyone?: boolean;
  mention_roles?: string[];
  /** Ids from uploadAttachment, by this user, into this room, not yet used. */
  attachments?: string[];
}

export interface UploadAttachmentOptions {
  /** Name to record (ignored for encrypted uploads, which are stored nameless). */
  filename?: string;
  width?: number;
  height?: number;
  /** The body is a client-encrypted blob - the server stores it as an opaque octet stream. */
  encrypted?: boolean;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Upload one file into a room ahead of sending the message that references it. Uses
 * XMLHttpRequest rather than fetch purely for upload progress events.
 */
export function uploadAttachment(roomId: string, file: Blob, opts: UploadAttachmentOptions = {}): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const name = opts.filename ?? (file instanceof File ? file.name : 'file');
    form.append('file', file, opts.encrypted ? 'blob' : name);
    if (opts.width && opts.height) {
      form.append('width', String(opts.width));
      form.append('height', String(opts.height));
    }
    if (opts.encrypted) form.append('encrypted', '1');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiUrl()}/rooms/${roomId}/attachments`);
    const token = localStorage.getItem('session_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Attachment);
        } catch {
          reject(new ApiError('Invalid upload response', xhr.status));
        }
        return;
      }
      let message = `HTTP ${xhr.status}`;
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        // keep the status text
      }
      reject(new ApiError(message, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

export function listMessages(roomId: string, params?: { before?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.before) search.set('before', params.before);
  if (params?.limit != null) search.set('limit', String(params.limit));
  const q = search.toString();
  return api<Message[]>(`/rooms/${roomId}/messages${q ? `?${q}` : ''}`);
}

export function getMessage(roomId: string, msgId: string) {
  return api<Message>(`/rooms/${roomId}/messages/${msgId}`);
}

export interface SearchMessagesParams {
  q?: string;
  from?: string;
  mentions?: string;
  has?: 'link' | 'image' | 'video' | 'audio' | 'file';
  before?: string;
  limit?: number;
}

export interface SearchMessagesResult {
  /** False for E2EE rooms - the server never sees their content, so it didn't scan at all. */
  searchable: boolean;
  messages: Message[];
  /** Present when there may be more matches further back; pass as `before` to continue. */
  next_before_id?: string;
}

/** Server-side message search - plaintext (non-E2EE) rooms only. E2EE rooms return
 * `{ searchable: false }`; search their history locally instead (already-decrypted
 * messages in the store, loading more with loadOlderMessages as needed). */
export function searchMessages(roomId: string, params: SearchMessagesParams) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.from) search.set('from', params.from);
  if (params.mentions) search.set('mentions', params.mentions);
  if (params.has) search.set('has', params.has);
  if (params.before) search.set('before', params.before);
  if (params.limit != null) search.set('limit', String(params.limit));
  return api<SearchMessagesResult>(`/rooms/${roomId}/messages/search?${search.toString()}`);
}

export interface SearchSpaceMessagesParams extends SearchMessagesParams {
  /** Discord's `in:` - restrict to one channel of the space. */
  in?: string;
}

export interface SearchSpaceMessagesResult {
  messages: Message[];
  next_before_id?: string;
  /** How many channels were actually scanned, and how many were skipped for being E2EE. */
  rooms_searched: number;
  encrypted_rooms: number;
}

/** Server-side search across every text channel of a space the caller can read. E2EE
 * channels are never scanned (the server holds only ciphertext) and are reported in
 * `encrypted_rooms` so the UI can say the results are incomplete. */
export function searchSpaceMessages(spaceId: string, params: SearchSpaceMessagesParams) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.from) search.set('from', params.from);
  if (params.mentions) search.set('mentions', params.mentions);
  if (params.has) search.set('has', params.has);
  if (params.in) search.set('in', params.in);
  if (params.before) search.set('before', params.before);
  if (params.limit != null) search.set('limit', String(params.limit));
  return api<SearchSpaceMessagesResult>(`/spaces/${spaceId}/messages/search?${search.toString()}`);
}

export function createMessage(roomId: string, input: CreateMessageInput) {
  return api<Message>(`/rooms/${roomId}/messages`, {
    method: 'POST',
    json: input,
  });
}

export function editMessage(roomId: string, msgId: string, content: { ciphertext: string } | { plaintext: string }) {
  return api<Message>(`/rooms/${roomId}/messages/${msgId}`, {
    method: 'PATCH',
    json: content,
  });
}

export function deleteMessage(roomId: string, msgId: string) {
  return api<void>(`/rooms/${roomId}/messages/${msgId}`, { method: 'DELETE' });
}

/** Adds the caller's own reaction; idempotent if they already reacted with this emoji. */
export function addReaction(roomId: string, msgId: string, emoji: string) {
  return api<{ reactions: MessageReaction[] }>(
    `/rooms/${roomId}/messages/${msgId}/reactions/${encodeURIComponent(emoji)}`,
    { method: 'PUT' }
  );
}

/** Removes the caller's own reaction. There is no endpoint to remove someone else's. */
export function removeReaction(roomId: string, msgId: string, emoji: string) {
  return api<{ reactions: MessageReaction[] }>(
    `/rooms/${roomId}/messages/${msgId}/reactions/${encodeURIComponent(emoji)}`,
    { method: 'DELETE' }
  );
}

/** Who reacted with a specific emoji - the hover tooltip's "X, Y and Z reacted" list. */
export function listReactors(roomId: string, msgId: string, emoji: string) {
  return api<Reactor[]>(`/rooms/${roomId}/messages/${msgId}/reactions/${encodeURIComponent(emoji)}`);
}
