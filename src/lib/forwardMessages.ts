import type { Attachment, Embed, MessageReference, MessageSnapshot } from '../api/messages';
import type { RoomParticipant } from '../api/rooms';
import type { SpaceRole } from '../api/spaces';
import {
  encryptedMetaFromView,
  isEncryptedAttachmentMeta,
  viewFromEncryptedMeta,
  type AttachmentView,
  type EncryptedAttachmentMeta,
} from './attachments/types';

/**
 * Forwarded messages (Discord's message forwarding).
 *
 * A forward carries a copy of another message - its text, files and embeds, when it was written
 * and last edited, never who wrote it - and nothing of its own (a comment is a separate message).
 * Into a plaintext room the server builds that copy from the source (`message_snapshots`), so
 * nobody can forge one. Into an end-to-end encrypted room it travels inside the ciphertext as
 * `forward` (FORWARD_KEY below), built here from what this device decrypted: the server never
 * sees it. An encrypted source never goes into a plaintext room - the server would be reading
 * words that were encrypted - so the forward dialog leaves such rooms out.
 */

/** The key a forward's copy has inside a decrypted message body. */
export const FORWARD_KEY = 'forward';

/** The most rooms one forward goes to at once (Discord's limit). */
export const MAX_FORWARD_TARGETS = 5;

/** A forward, ready to render: from the server's snapshot or from a decrypted body. */
export interface ForwardView {
  content: string;
  attachments: AttachmentView[];
  embeds: Embed[];
  /** When the original was written (and last edited), RFC 3339. */
  timestamp: string;
  editedTimestamp?: string;
  /** Where the original is: enough to jump there when the reader can see that room. */
  source?: { roomId?: string; messageId?: string; spaceId?: string; domain?: string };
}

/** The encrypted body's forward (what this file writes and reads). */
interface EncryptedForward {
  content: string;
  attachments?: (EncryptedAttachmentMeta | Attachment)[];
  embeds?: Embed[];
  timestamp: string;
  edited_timestamp?: string;
  source?: { room_id?: string; message_id?: string; space_id?: string; domain?: string };
}

function plainAttachmentView(a: Attachment): AttachmentView {
  return {
    id: a.id,
    url: a.url,
    filename: a.filename || 'file',
    contentType: a.content_type || 'application/octet-stream',
    size: a.size,
    width: a.width,
    height: a.height,
  };
}

function isPlainAttachment(x: unknown): x is Attachment {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  return typeof d.id === 'string' && typeof d.url === 'string' && /^https?:\/\//i.test(d.url) && !d.key;
}

function sourceOf(ref: MessageReference | undefined): ForwardView['source'] {
  if (!ref) return undefined;
  return {
    ...(ref.room_id ? { roomId: ref.room_id } : {}),
    ...(ref.message_id ? { messageId: ref.message_id } : {}),
    ...(ref.space_id ? { spaceId: ref.space_id } : {}),
    ...(ref.domain ? { domain: ref.domain } : {}),
  };
}

/** A plaintext room's forward, from the server's snapshot. */
export function forwardFromServer(m: { message_snapshots?: MessageSnapshot[]; message_reference?: MessageReference }): ForwardView | undefined {
  const snap = m.message_snapshots?.[0]?.message;
  if (!snap) return undefined;
  return {
    content: snap.content ?? '',
    attachments: (snap.attachments ?? []).filter((a) => !a.encrypted).map(plainAttachmentView),
    embeds: Array.isArray(snap.embeds) ? snap.embeds : [],
    timestamp: snap.timestamp,
    ...(snap.edited_timestamp ? { editedTimestamp: snap.edited_timestamp } : {}),
    source: sourceOf(m.message_reference),
  };
}

/** An encrypted room's forward, from the decrypted body. Anything malformed reads as none. */
export function forwardFromContent(content: Record<string, unknown> | undefined): ForwardView | undefined {
  const raw = content?.[FORWARD_KEY];
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Partial<EncryptedForward>;
  if (typeof f.content !== 'string' || typeof f.timestamp !== 'string') return undefined;
  const attachments: AttachmentView[] = [];
  for (const a of Array.isArray(f.attachments) ? f.attachments : []) {
    if (isEncryptedAttachmentMeta(a)) attachments.push(viewFromEncryptedMeta(a));
    else if (isPlainAttachment(a)) attachments.push(plainAttachmentView(a));
  }
  const src = f.source && typeof f.source === 'object' ? f.source : undefined;
  return {
    content: f.content.slice(0, 4000),
    attachments,
    embeds: Array.isArray(f.embeds) ? f.embeds.filter((e): e is Embed => !!e && typeof e === 'object') : [],
    timestamp: f.timestamp,
    ...(typeof f.edited_timestamp === 'string' ? { editedTimestamp: f.edited_timestamp } : {}),
    ...(src
      ? {
          source: {
            ...(typeof src.room_id === 'string' ? { roomId: src.room_id } : {}),
            ...(typeof src.message_id === 'string' ? { messageId: src.message_id } : {}),
            ...(typeof src.space_id === 'string' ? { spaceId: src.space_id } : {}),
            ...(typeof src.domain === 'string' ? { domain: src.domain } : {}),
          },
        }
      : {}),
  };
}

/** What a message to be forwarded says, as this device can read it. */
export interface ForwardSource {
  id: string;
  room_id: string;
  space_id?: string;
  plaintext?: string;
  attachments?: AttachmentView[];
  embeds?: Embed[];
  created_at: string;
  updated_at?: string;
  /** A forward being forwarded: its own copy goes on, pointing at the original. */
  forward?: ForwardView;
}

/** The forward an encrypted room's body carries. Mentions are written out as names first
 * (flattenMentions): the people reading it may not share a space with whoever was mentioned. */
export function encryptedForwardOf(src: ForwardSource, flatten: (text: string) => string): EncryptedForward {
  const inner = src.forward;
  const files = inner ? inner.attachments : (src.attachments ?? []);
  const attachments: (EncryptedAttachmentMeta | Attachment)[] = [];
  for (const v of files) {
    const meta = encryptedMetaFromView(v);
    if (meta) attachments.push(meta);
    else if (/^https?:\/\//i.test(v.url))
      attachments.push({ id: v.id, url: v.url, filename: v.filename, content_type: v.contentType, size: v.size, width: v.width, height: v.height });
  }
  const edited = inner ? inner.editedTimestamp : editedAt(src);
  const source = inner?.source
    ? { room_id: inner.source.roomId, message_id: inner.source.messageId, space_id: inner.source.spaceId, domain: inner.source.domain }
    : { room_id: src.room_id, message_id: src.id, ...(src.space_id ? { space_id: src.space_id } : {}) };
  return {
    content: inner ? inner.content : flatten(src.plaintext ?? ''),
    ...(attachments.length ? { attachments } : {}),
    ...((inner?.embeds ?? src.embeds ?? []).length ? { embeds: inner?.embeds ?? src.embeds } : {}),
    timestamp: inner ? inner.timestamp : src.created_at,
    ...(edited ? { edited_timestamp: edited } : {}),
    source,
  };
}

function editedAt(src: ForwardSource): string | undefined {
  if (!src.updated_at) return undefined;
  const c = Date.parse(src.created_at);
  const u = Date.parse(src.updated_at);
  return Number.isFinite(c) && Number.isFinite(u) && u - c > 1000 ? src.updated_at : undefined;
}

/**
 * Mentions written out as the names they stand for - the server does the same for a plaintext
 * forward or a published copy - so `<@id>` never resolves to, or pings, anyone where the text
 * goes, and reads the same to people who do not know the id.
 */
export function flattenMentions(
  text: string,
  people: RoomParticipant[] | undefined,
  roles: SpaceRole[] | undefined,
  roomName: (id: string) => string | undefined
): string {
  const name = (id: string) => {
    const p = people?.find((x) => x.id === id);
    return p ? (p.display_name || p.username) : undefined;
  };
  return text
    .replace(/<@&(\d+)>/g, (_, id: string) => `@${roles?.find((r) => r.id === id)?.name ?? 'deleted-role'}`)
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${name(id) ?? 'unknown-user'}`)
    .replace(/<#(\d+)>/g, (_, id: string) => `#${roomName(id) ?? 'unknown-room'}`);
}
