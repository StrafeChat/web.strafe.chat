/**
 * Turning a message off the wire into something renderable.
 *
 * A message can arrive in several shapes — plaintext, a Megolm/Olm ciphertext, a legacy
 * ciphertext from a retired engine, attachment-only — and history load, realtime create and
 * realtime update all have to agree on how to read each one. That dispatch lives here rather
 * than in the store so the store is about state, and so the placeholder rules (waiting for a
 * key vs. sent before you joined vs. genuinely broken) are stated in one place.
 */

import type { SpaceMember } from '../api/spaces';
import type { Attachment } from '../api/messages';
import type { Room, RoomParticipant } from '../api/rooms';
import { decryptMessage, isLegacyCiphertext } from '../lib/e2ee';
import { PLAINTEXT_PREFIX } from '../lib/e2ee/constants';
import { spaceMemberUserIds } from '../lib/e2ee/spaceMembers';
import { isEncryptedAttachmentMeta, viewFromEncryptedMeta, type AttachmentView } from '../lib/attachments/types';
import { rooms } from '../stores/rooms';
import { spaces } from '../stores/spaces';
import { spaceMembers } from '../stores/spaceMembers';

const LEGACY_PLACEHOLDER = '[Message used a retired encryption scheme and can no longer be read]';
const PENDING_PLACEHOLDER = '[Waiting for encryption key…]';
const BEFORE_JOIN_PLACEHOLDER = '[Sent before you joined this space]';

/** Mirrors equinox's messages.Service.roomE2EEOff: group PMs default to E2EE on (must be
 * explicitly disabled), space channels default to E2EE off (must be explicitly enabled).
 * Keep this truth table in sync with the backend or a send/edit will populate the column
 * the server doesn't expect for that room and get rejected as invalid input. */
export function roomE2EEOff(room: Room, isGroupRoom: boolean, isSpaceTextRoom: boolean): boolean {
  if (isGroupRoom) return room.e2ee_enabled === false;
  if (isSpaceTextRoom) return room.e2ee_enabled !== true;
  // A 1:1 PM is E2EE unless explicitly flagged plain-text - the official account's DM is,
  // since that account has no encryption keys (equinox roomE2EEOff mirrors this).
  return room.e2ee_enabled === false;
}

/** Every user whose devices should receive this room's Megolm session key. Always
 * includes the current user, so their own other devices - and this device's later
 * re-reads of its own sent messages - can decrypt too. Space channels have no
 * `room.participants` (the backend fans those out to space membership instead), so their
 * member list is fetched separately. */
export async function resolveMemberUserIds(
  currentUserId: string,
  room: Room,
  participants: RoomParticipant[],
  isSpaceTextRoom: boolean
): Promise<string[]> {
  const ids = new Set<string>();
  if (isSpaceTextRoom && room.space_id) {
    for (const uid of await spaceMemberUserIds(room.space_id)) ids.add(uid);
  } else {
    for (const p of participants) ids.add(p.id);
  }
  ids.add(currentUserId);
  return [...ids];
}

/** Space id for a room, from whichever store has it. */
function spaceIdForRoom(roomId: string): string | undefined {
  const fromRooms = rooms.rooms.find((r) => r.id === roomId)?.space_id;
  if (fromRooms) return fromRooms;
  for (const [sid, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    if (list.some((r) => r.id === roomId)) return sid;
  }
  return undefined;
}

/**
 * Megolm only lets a member read from the point the session was shared with them, so
 * anything sent to an E2EE space room before the current user joined the space can never
 * be decrypted on purpose - that's the point, not a delay. Distinguish it from the "key
 * still in flight" case so the placeholder doesn't promise something that won't happen.
 */
function sentBeforeSpaceJoin(roomId: string, createdAt: string, currentUserId: string): boolean {
  const spaceId = spaceIdForRoom(roomId);
  if (!spaceId) return false;
  const me = (spaceMembers.bySpaceId[spaceId] ?? []).find((m) => m.id === currentUserId) as SpaceMember | undefined;
  if (!me?.joined_at) return false;
  const joined = new Date(me.joined_at).getTime();
  const created = new Date(createdAt).getTime();
  return Number.isFinite(joined) && Number.isFinite(created) && created < joined;
}

export interface EncryptedMessageLike {
  id: string;
  room_id: string;
  sender_id: string;
  ciphertext: string;
  created_at: string;
  plaintext?: string;
  attachments?: Attachment[];
}

/** Display form of a server-recorded (plaintext-room) attachment. */
export function viewFromServerAttachment(a: Attachment): AttachmentView {
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

/** Attachments carried inside a decrypted E2EE body (with their keys). */
function attachmentsFromContent(content: Record<string, unknown> | undefined): AttachmentView[] {
  const raw = content?.attachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEncryptedAttachmentMeta).map(viewFromEncryptedMeta);
}

/** The fields a wire message resolves to; the store spreads these onto its own record. */
export interface ResolvedFields {
  plaintext?: string;
  decryptError?: boolean;
  decryptPending?: boolean;
  notEncrypted?: boolean;
  legacyUndecryptable?: boolean;
  attachments: AttachmentView[];
}

/** Resolve a message's displayable plaintext (and attachments), dispatching on its wire
 * format. Shared by history load, realtime create, and realtime update so all three paths
 * stay in sync. */
export async function resolvePlaintext(currentUserId: string, m: EncryptedMessageLike): Promise<ResolvedFields> {
  // Server-readable attachments (plaintext rooms). Encrypted ones are skipped here: their
  // real metadata and key only exist inside the ciphertext.
  const serverAttachments = (m.attachments ?? []).filter((a) => !a.encrypted).map(viewFromServerAttachment);
  if (m.plaintext != null && m.plaintext !== '') {
    return { plaintext: m.plaintext, notEncrypted: true, attachments: serverAttachments };
  }
  const ctext = m.ciphertext ?? '';
  if (!ctext) {
    // Attachment-only message in a plaintext room (no text, so no plaintext column either).
    return { plaintext: '', notEncrypted: true, attachments: serverAttachments };
  }
  if (isLegacyCiphertext(ctext)) {
    return { plaintext: LEGACY_PLACEHOLDER, legacyUndecryptable: true, attachments: [] };
  }
  const notEncrypted = ctext.startsWith(PLAINTEXT_PREFIX);
  try {
    const result = await decryptMessage(currentUserId, m.room_id, ctext, {
      senderId: m.sender_id,
      eventId: m.id,
      createdAt: m.created_at,
    });
    if (result.pending) {
      const placeholder = sentBeforeSpaceJoin(m.room_id, m.created_at, currentUserId)
        ? BEFORE_JOIN_PLACEHOLDER
        : PENDING_PLACEHOLDER;
      return { plaintext: placeholder, decryptPending: true, attachments: [] };
    }
    return {
      plaintext: result.plaintext,
      notEncrypted,
      attachments: notEncrypted ? serverAttachments : attachmentsFromContent(result.content),
    };
  } catch (e) {
    console.error('[E2EE] Decrypt failed for message', m.id, 'from', m.sender_id, e);
    return { plaintext: '', decryptError: true, attachments: [] };
  }
}

/** A realtime MESSAGE_CREATE/UPDATE echo resolves its own plaintext independently of
 * whatever's already in the store, and can race a message we already decrypted (our own
 * optimistic send, or an earlier load) - if that race loses (e.g. the room key hadn't
 * finished propagating to *this* decrypt attempt yet), don't let a "waiting for keys"
 * placeholder clobber a plaintext we already resolved correctly. Only take the fresh
 * result when it's at least as good as what's already shown. */
export function preferResolved(existing: Readonly<Partial<ResolvedFields>>, incoming: ResolvedFields): ResolvedFields {
  const incomingWorse = (incoming.decryptPending || incoming.decryptError) && !existing.decryptPending && !existing.decryptError && !existing.legacyUndecryptable;
  return incomingWorse
    ? {
        plaintext: existing.plaintext,
        decryptError: existing.decryptError,
        decryptPending: existing.decryptPending,
        notEncrypted: existing.notEncrypted,
        legacyUndecryptable: existing.legacyUndecryptable,
        attachments: existing.attachments ?? [],
      }
    : incoming;
}
