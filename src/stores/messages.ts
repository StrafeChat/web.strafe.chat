import { previewUrlsFor } from '../lib/linkPreviewUrls';
import { warmLinkPreviews } from './linkPreviews';
import { batch } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import {
  listMessages,
  createMessage,
  editMessage as editMessageApi,
  uploadAttachment,
  addReaction as addReactionApi,
  removeReaction as removeReactionApi,
  type Attachment,
  type Message,
  type CreateMessageInput,
  type MessageReaction,
} from '../api/messages';
import { ensureDevice, encryptMessage } from '../lib/e2ee';
import { getCurrentDeviceId } from '../lib/e2ee/machine';
import { encryptAttachment } from '../lib/attachments/crypto';
import {
  encryptedMetaFromView,
  viewFromEncryptedMeta,
  type AttachmentView,
  type EncryptedAttachmentMeta,
} from '../lib/attachments/types';
import type { PendingAttachment } from '../lib/attachments/draft';
import {
  preferResolved,
  resolveMemberUserIds,
  resolvePlaintext,
  roomE2EEOff,
  viewFromServerAttachment,
  type ResolvedFields,
} from '../lib/messageWireFormat';
import { removeTyping } from './typing';
import { captureScrollAnchor, restoreScrollAnchor, rowIsAboveViewport, rowIsBelowViewport } from '../lib/scrollAnchor';
import { forgetScrollPosition } from '../lib/scrollPositions';

/** Re-exported: search builds display messages from raw server rows too. */
export { viewFromServerAttachment };
import { auth } from './auth';
import { settings } from './settings';
import { rooms, updateRoomLastMessage } from './rooms';
import { spaces, updateSpaceRoomLastMessage } from './spaces';
import { onStargateEvent } from '../services/stargate/client';
import { maybeNotifyMessage } from '../lib/notifications';
import { setReadState, extractMentionedUserIds, extractMentionedRoleIds, mentionsEveryone, messageIdGt, isSnowflake } from './readState';

/** Sort messages by created_at ascending (oldest first) */
function sortByCreatedAt<T extends { created_at: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Generate a unique temp ID for optimistic messages */
function createTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Newest real (snowflake) message id loaded for a room - the cursor for "load newer". */
function newestRealId(list: DecryptedMessage[]): string | undefined {
  for (let i = list.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(list[i]!.id)) return list[i]!.id;
  }
  return undefined;
}

/** Decrypt (or pass through plaintext) a page of raw server messages into display messages. */
async function decryptPage(list: Message[], currentUserId: string): Promise<DecryptedMessage[]> {
  return Promise.all(
    list.map(async (m): Promise<DecryptedMessage> => {
      if (m.system_type) return { ...m, plaintext: '', attachments: [] };
      const resolved = await resolvePlaintext(currentUserId, m);
      return { ...m, ...resolved };
    })
  );
}

/** Warm this page's link-preview cards before it renders, so they don't pop in and reflow. */
async function warmPagePreviews(roomId: string, decrypted: DecryptedMessage[], ms: number): Promise<void> {
  if (!linkPreviewsAllowedIn(roomId)) return;
  const urls = new Set<string>();
  for (const m of decrypted) {
    if (!m.system_type && m.plaintext) for (const u of previewUrlsFor(m.plaintext)) urls.add(u);
  }
  if (urls.size > 0) await warmLinkPreviews(urls, ms);
}

/** Merge new messages into a room's list by id (dedup), kept sorted oldest-first. */
function mergeMessages(existing: DecryptedMessage[] | undefined, incoming: DecryptedMessage[]): DecryptedMessage[] {
  const base = existing ?? [];
  const ids = new Set(base.map((x) => x.id));
  const merged = [...base];
  for (const m of incoming) {
    if (!ids.has(m.id)) {
      ids.add(m.id);
      merged.push(m);
    }
  }
  return sortByCreatedAt(merged);
}

export interface DecryptedMessage extends Omit<Message, 'attachments'> {
  plaintext?: string;
  /** Attachments in display form. In E2EE rooms these came out of the decrypted body and
   * carry the per-file key; the server-side copy only knows id/url/size for those. */
  attachments?: AttachmentView[];
  decryptError?: boolean;
  /** True when the Megolm room key for this message hasn't arrived yet - a "waiting for
   * key" state, not an error; it resolves itself once the to-device share is processed. */
  decryptPending?: boolean;
  /** True when the message predates the current engine (old static-key scheme) and can no
   * longer be decrypted - that engine's key material was deleted along with it. */
  legacyUndecryptable?: boolean;
  /** True when message was sent without E2EE (room has E2EE disabled) */
  notEncrypted?: boolean;
  /** True when message is optimistic (not yet confirmed by server) */
  pending?: boolean;
  reactions?: MessageReaction[];
}

export interface MessagesState {
  byRoom: Record<string, DecryptedMessage[]>;
  loading: Record<string, boolean>;
  loadingOlder: Record<string, boolean>;
  hasMoreOlder: Record<string, boolean>;
  /** True when the loaded window is NOT the live tail - i.e. the user jumped to an older
   * message (via a reply/search) and there are newer messages below the window to page in.
   * False for a normal room (its newest page always includes the live tail). Gates whether a
   * live MESSAGE_CREATE is appended and whether "load newer" / "jump to present" do anything. */
  hasMoreNewer: Record<string, boolean>;
  loadingNewer: Record<string, boolean>;
  sending: Record<string, boolean>;
  /** Bumped when a message is appended at the live bottom; the list follows it only if the
   * viewer was already there. */
  scrollToBottomTick: Record<string, number>;
  /** Bumped to take the viewer to the live bottom wherever they are - their own send, "jump
   * to present". */
  scrollToBottomForce: Record<string, number>;
  /** A message the list should scroll to as soon as its row exists (a jump); consumed by the
   * list, which clears it. */
  jumpTarget: Record<string, JumpTarget | null>;
}

export interface JumpTarget {
  id: string;
  /** Distinguishes two jumps to the same message. */
  nonce: number;
  /** Animate when the row is already on the page; a freshly loaded window always snaps. */
  smooth: boolean;
}

export const [messages, setMessages] = createStore<MessagesState>({
  byRoom: {},
  loading: {},
  loadingOlder: {},
  hasMoreOlder: {},
  hasMoreNewer: {},
  loadingNewer: {},
  sending: {},
  scrollToBottomTick: {},
  scrollToBottomForce: {},
  jumpTarget: {},
});

/**
 * Rooms with a jump-to-message in flight. When you jump to a message that isn't loaded the
 * window is replaced by one centred on it (loadMessagesAround); for a jump into a DIFFERENT
 * room the page's room-change effect must NOT also fire its normal "load the tail" - that
 * would race the around-load and usually win, dropping you at the bottom instead of on the
 * target. The page checks hasPendingJump() and defers to the around-load. Not reactive - it's
 * read once when the room changes.
 */
const pendingJumps = new Set<string>();
export function hasPendingJump(roomId: string): boolean {
  return pendingJumps.has(roomId);
}

const MESSAGES_PAGE_SIZE = 50;
/**
 * The loaded window is bounded, as in Discord: paging history in one direction drops rows
 * from the far end once the list grows past this, and the dropped side is paged back in on
 * the way back (hasMoreOlder / hasMoreNewer flip on). Keeps the DOM flat no matter how far
 * back someone reads. Only rows well outside the viewport are ever dropped.
 */
const MAX_LOADED_MESSAGES = 300;
const TRIM_MARGIN_PX = 400;
let jumpNonce = 0;

function setTempAttachmentProgress(roomId: string, tempId: string, localId: string, progress: number) {
  setMessages('byRoom', roomId, (prev) =>
    (prev ?? []).map((m) =>
      m.id !== tempId
        ? m
        : { ...m, attachments: (m.attachments ?? []).map((a) => (a.id === localId ? { ...a, progress } : a)) }
    )
  );
}

/**
 * Re-attempt decryption for every message still waiting on a room key. Megolm keys arrive
 * as to-device messages, and a MESSAGE_CREATE can easily be processed before the
 * to-device share that unlocks it (they're published back-to-back by the sender), so
 * without this a message that raced its own key would sit at "waiting" until a reload.
 * Called after each batch of to-device messages is fed into the engine.
 */
export async function retryPendingDecrypts(): Promise<void> {
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  for (const [roomId, list] of Object.entries(messages.byRoom)) {
    const waiting = list.filter((m) => m.decryptPending && !m.system_type && !m.id.startsWith('temp-'));
    if (waiting.length === 0) continue;
    const resolved = await Promise.all(
      waiting.map(async (m) => {
        // Not the stored object: its `plaintext` is the placeholder, which resolvePlaintext
        // would otherwise take for server-stored plaintext.
        const fields = await resolvePlaintext(currentUserId, {
          id: m.id,
          room_id: m.room_id,
          sender_id: m.sender_id,
          ciphertext: m.ciphertext,
          created_at: m.created_at,
        });
        return [m.id, fields] as const;
      })
    );
    const changed = new Map(resolved.filter(([, f]) => !f.decryptPending));
    if (changed.size === 0) continue;
    setMessages('byRoom', roomId, (prev) =>
      (prev ?? []).map((m) => (changed.has(m.id) ? { ...m, ...changed.get(m.id)! } : m))
    );
  }
}

/** How long a page of history waits for its link previews before rendering anyway. */
const PREVIEW_WARM_INITIAL_MS = 1200;
const PREVIEW_WARM_OLDER_MS = 600;

/** Mirrors MessageList's gate: plain rooms always preview; encrypted rooms only by choice. */
function linkPreviewsAllowedIn(roomId: string): boolean {
  const room = rooms.rooms.find((r) => r.id === roomId);
  if (!room) return false;
  return room.e2ee_enabled !== true || !!settings.linkPreviewsInEncrypted;
}

/** Newest message the server reported for a room (PM list or a space's channel list), if cached. */
function roomLastMessageId(roomId: string): string | undefined {
  const pm = rooms.rooms.find((r) => r.id === roomId);
  if (pm?.last_message_id) return pm.last_message_id;
  for (const list of Object.values(spaces.spaceRoomsBySpaceId)) {
    const r = list.find((x) => x.id === roomId);
    if (r?.last_message_id) return r.last_message_id;
  }
  return undefined;
}

/** True when the room has messages newer than the newest one loaded - the window isn't the live tail. */
function tailBehind(roomId: string, newestLoaded: string | undefined): boolean {
  const last = roomLastMessageId(roomId);
  return !!last && !!newestLoaded && messageIdGt(last, newestLoaded);
}

/**
 * Load the newest page of a room (no `before`), or the page before `before` for upward
 * infinite scroll. Older pages prepend under the viewer: the row they were looking at is
 * anchored across the change (prepended rows, the top skeleton, a trimmed tail) so nothing
 * moves on screen. Entering a room doesn't scroll from here - the list lands itself.
 */
export async function loadMessages(
  roomId: string,
  before?: string,
  getScrollContainer?: () => HTMLDivElement | undefined,
  opts?: { quiet?: boolean }
) {
  void opts;
  const isInitialLoad = !before;
  if (isInitialLoad) {
    // Someone reading an older window (jumped to a message, or scrolled far enough up that
    // the tail was dropped) keeps it: merging the live tail into it would splice two
    // non-contiguous ranges. Whatever they missed pages in as they scroll down.
    if (messages.hasMoreNewer[roomId] === true) return;
    // The page swaps the list for a skeleton while `loading` is set, so only raise it when
    // there is nothing on screen yet; a refresh of an open room merges in place.
    if ((messages.byRoom[roomId]?.length ?? 0) === 0) setMessages('loading', roomId, true);
    setMessages('hasMoreOlder', roomId, true);
    setMessages('hasMoreNewer', roomId, false);
  } else {
    setMessages('loadingOlder', roomId, true);
  }
  const currentUserId = auth.user?.id;
  if (!currentUserId) {
    if (isInitialLoad) setMessages('loading', roomId, false);
    else setMessages('loadingOlder', roomId, false);
    return;
  }

  try {
    try {
      await ensureDevice(currentUserId);
    } catch (e) {
      console.warn('ensureDevice failed, decryption may fail:', e);
    }
    const list = await listMessages(roomId, { before, limit: MESSAGES_PAGE_SIZE });
    const decrypted = await decryptPage(list, currentUserId);
    // Fetch this page's link previews before showing it, so the cards are in place when the
    // messages appear instead of popping in one by one and shoving the conversation around
    // (the same page of history would otherwise reflow once per link). Bounded: a slow site
    // can't hold the room back, its card just arrives late as before.
    await warmPagePreviews(roomId, decrypted, isInitialLoad ? PREVIEW_WARM_INITIAL_MS : PREVIEW_WARM_OLDER_MS);

    const existing = messages.byRoom[roomId] ?? [];
    if (isInitialLoad && existing.length > 0 && list.length >= MESSAGES_PAGE_SIZE) {
      // A refresh (reconnect) whose newest page doesn't reach back to what is loaded: more
      // than a page arrived meanwhile. Keep the window and let the gap page in from the
      // bottom rather than splice the tail onto it.
      const oldestFetched = sortByCreatedAt(decrypted)[0]?.id;
      const newestExisting = newestRealId(existing);
      if (oldestFetched && newestExisting && isSnowflake(oldestFetched) && messageIdGt(oldestFetched, newestExisting)) {
        setMessages('hasMoreNewer', roomId, true);
        return;
      }
    }

    const container = getScrollContainer?.();
    const anchor = container ? captureScrollAnchor(container) : null;
    let merged = mergeMessages(existing, decrypted);
    let droppedTail = false;
    if (!isInitialLoad && container && merged.length > MAX_LOADED_MESSAGES) {
      const tail = merged.slice(MAX_LOADED_MESSAGES);
      if (!tail.some((m) => m.pending) && rowIsBelowViewport(container, tail[0]!.id, TRIM_MARGIN_PX)) {
        merged = merged.slice(0, MAX_LOADED_MESSAGES);
        droppedTail = true;
      }
    }
    batch(() => {
      setMessages('byRoom', roomId, merged);
      setMessages('hasMoreOlder', roomId, list.length >= MESSAGES_PAGE_SIZE);
      if (droppedTail) setMessages('hasMoreNewer', roomId, true);
      if (isInitialLoad) setMessages('loading', roomId, false);
      else setMessages('loadingOlder', roomId, false);
    });
    if (!isInitialLoad && container && anchor) restoreScrollAnchor(container, anchor);
  } finally {
    if (isInitialLoad) {
      setMessages('loading', roomId, false);
    } else {
      setMessages('loadingOlder', roomId, false);
    }
  }
}

/** Load older messages (for infinite scroll up). Uses oldest message id as cursor. */
export async function loadOlderMessages(
  roomId: string,
  getScrollContainer?: () => HTMLDivElement | undefined
): Promise<boolean> {
  const list = messages.byRoom[roomId] ?? [];
  if (list.length === 0 || messages.loadingOlder[roomId]) return false;
  if (messages.hasMoreOlder[roomId] === false) return false;
  const oldest = list.find((m) => !m.id.startsWith('temp-'));
  if (!oldest) return false;
  await loadMessages(roomId, oldest.id, getScrollContainer);
  return true;
}

/**
 * Load a window of history centred on `messageId` (server `around=`), REPLACING the loaded
 * window. The around-window is disjoint from whatever was loaded (usually the live tail), so
 * merging would splice two non-contiguous ranges and render a silent gap. Sets hasMoreOlder /
 * hasMoreNewer so infinite scroll resumes in both directions - scrolling down from here pages
 * newer until it reconnects to the live tail (hasMoreNewer -> false) - and hands the list a
 * jump target to centre once the rows exist. Used by jumpToMessage.
 */
export async function loadMessagesAround(roomId: string, messageId: string): Promise<boolean> {
  const currentUserId = auth.user?.id;
  if (!currentUserId) return false;
  pendingJumps.add(roomId);
  // The skeleton only when nothing is on screen (a jump into a channel never opened); an
  // open list stays mounted and has its window swapped underneath - unmounting it would
  // throw away its scroll state and land the remount at the bottom.
  if ((messages.byRoom[roomId]?.length ?? 0) === 0) setMessages('loading', roomId, true);
  try {
    try {
      await ensureDevice(currentUserId);
    } catch (e) {
      console.warn('ensureDevice failed, decryption may fail:', e);
    }
    const list = await listMessages(roomId, { around: messageId, limit: MESSAGES_PAGE_SIZE });
    const decrypted = await decryptPage(list, currentUserId);
    await warmPagePreviews(roomId, decrypted, PREVIEW_WARM_INITIAL_MS);
    const sorted = sortByCreatedAt(decrypted);
    // A full half on a side implies there is more that way; the room's last_message_id, when
    // known, also says whether the window already reaches the live tail.
    const half = Math.floor(MESSAGES_PAGE_SIZE / 2);
    let olderCount = 0;
    let newerCount = 0;
    for (const m of sorted) {
      if (!isSnowflake(m.id) || m.id === messageId) continue;
      if (messageIdGt(messageId, m.id)) olderCount++;
      else newerCount++;
    }
    forgetScrollPosition(roomId);
    batch(() => {
      setMessages('byRoom', roomId, sorted);
      setMessages('hasMoreOlder', roomId, olderCount >= half);
      setMessages('hasMoreNewer', roomId, newerCount >= half || tailBehind(roomId, newestRealId(sorted)));
      setMessages('loadingOlder', roomId, false);
      setMessages('loadingNewer', roomId, false);
      setMessages('jumpTarget', roomId, { id: messageId, nonce: ++jumpNonce, smooth: false });
      setMessages('loading', roomId, false);
    });
    return true;
  } finally {
    setMessages('loading', roomId, false);
    pendingJumps.delete(roomId);
  }
}

/**
 * Load newer messages (infinite scroll DOWN out of a jumped-to window). Uses the newest loaded
 * id as the `after` cursor. Appending below the viewport doesn't move it, but a trimmed head
 * does, so the viewer's row is anchored across the change like an older page is. When the page
 * comes back short and nothing newer arrived meanwhile, the window has reconnected with the
 * live tail: hasMoreNewer flips off and live MESSAGE_CREATEs resume appending.
 */
export async function loadNewerMessages(
  roomId: string,
  getScrollContainer?: () => HTMLDivElement | undefined
): Promise<boolean> {
  const list = messages.byRoom[roomId] ?? [];
  if (list.length === 0 || messages.loadingNewer[roomId]) return false;
  if (messages.hasMoreNewer[roomId] !== true) return false;
  const after = newestRealId(list);
  if (!after) return false;
  const currentUserId = auth.user?.id;
  if (!currentUserId) return false;
  setMessages('loadingNewer', roomId, true);
  try {
    // Compared after the fetch: a changed last_message_id means something arrived while the
    // page was in flight and is not in it. Comparing against the stale value instead would
    // loop forever when the room's last message is one that no longer lists (deleted).
    const lastBefore = roomLastMessageId(roomId);
    const fetched = await listMessages(roomId, { after, limit: MESSAGES_PAGE_SIZE });
    const decrypted = await decryptPage(fetched, currentUserId);
    await warmPagePreviews(roomId, decrypted, PREVIEW_WARM_OLDER_MS);
    const container = getScrollContainer?.();
    const anchor = container ? captureScrollAnchor(container) : null;
    let merged = mergeMessages(messages.byRoom[roomId], decrypted);
    let droppedHead = false;
    if (container && merged.length > MAX_LOADED_MESSAGES) {
      const cut = merged.length - MAX_LOADED_MESSAGES;
      if (rowIsAboveViewport(container, merged[cut - 1]!.id, TRIM_MARGIN_PX)) {
        merged = merged.slice(cut);
        droppedHead = true;
      }
    }
    const arrivedMeanwhile = roomLastMessageId(roomId) !== lastBefore;
    const moreNewer = fetched.length >= MESSAGES_PAGE_SIZE || (arrivedMeanwhile && tailBehind(roomId, newestRealId(merged)));
    batch(() => {
      setMessages('byRoom', roomId, merged);
      if (droppedHead) setMessages('hasMoreOlder', roomId, true);
      setMessages('hasMoreNewer', roomId, moreNewer);
      setMessages('loadingNewer', roomId, false);
    });
    if (container && anchor) restoreScrollAnchor(container, anchor);
    return true;
  } finally {
    setMessages('loadingNewer', roomId, false);
  }
}

/**
 * Scroll to a message, loading a window around it first when it isn't in the loaded range (a
 * reply target or search hit from before the loaded history) and then resuming infinite scroll
 * from there. Safe for the current room or one just navigated to - the page defers its own
 * tail-load via hasPendingJump while the around-load runs, and the list applies the target
 * when it lands in the room.
 */
export async function jumpToMessage(roomId: string, messageId: string): Promise<void> {
  if (!roomId || !messageId) return;
  if (messages.byRoom[roomId]?.some((m) => m.id === messageId)) {
    setMessages('jumpTarget', roomId, { id: messageId, nonce: ++jumpNonce, smooth: true });
    return;
  }
  if (pendingJumps.has(roomId)) return;
  await loadMessagesAround(roomId, messageId);
}

/**
 * Return to the live tail from a jumped-to window, REPLACING the loaded messages with a fresh
 * newest page (a merge would splice the disjoint window onto the tail and leave a gap). No-op
 * when already at the tail. Backs the "jump to present" bar and send-while-reading-history.
 */
export async function jumpToPresent(roomId: string): Promise<void> {
  const currentUserId = auth.user?.id;
  if (!currentUserId || messages.hasMoreNewer[roomId] !== true) return;
  // Live messages append from here on; they join the tail fetched below.
  setMessages('hasMoreNewer', roomId, false);
  try {
    try {
      await ensureDevice(currentUserId);
    } catch (e) {
      console.warn('ensureDevice failed, decryption may fail:', e);
    }
    const list = await listMessages(roomId, { limit: MESSAGES_PAGE_SIZE });
    const decrypted = await decryptPage(list, currentUserId);
    await warmPagePreviews(roomId, decrypted, PREVIEW_WARM_INITIAL_MS);
    const newest = newestRealId(decrypted);
    forgetScrollPosition(roomId);
    batch(() => {
      setMessages('byRoom', roomId, (prev) => {
        // Keep what arrived live while the tail was fetched, and own sends in flight; the
        // rest of the old window is disjoint from the tail and would leave a gap.
        const live = (prev ?? []).filter(
          (m) => m.pending || (newest != null && isSnowflake(m.id) && messageIdGt(m.id, newest))
        );
        return mergeMessages(decrypted, live);
      });
      setMessages('hasMoreOlder', roomId, list.length >= MESSAGES_PAGE_SIZE);
      setMessages('loadingNewer', roomId, false);
      setMessages('scrollToBottomForce', roomId, (t) => (t ?? 0) + 1);
    });
  } catch (err) {
    setMessages('hasMoreNewer', roomId, true);
    throw err;
  }
}

export async function sendMessage(
  roomId: string,
  plaintext: string,
  replyToId?: string,
  pendingAttachments: PendingAttachment[] = []
): Promise<Message | null> {
  const room = rooms.rooms.find((r) => r.id === roomId);
  const currentUserId = auth.user?.id;
  if (!room || !currentUserId) return null;
  if (!plaintext && pendingAttachments.length === 0) return null;

  const participants = room.participants ?? [];
  const otherParticipant = participants.find((p) => p.id !== currentUserId);
  const isNotesRoom = !otherParticipant && participants.length === 1;
  const isGroupRoom = room.type === 2 && participants.length >= 2;
  const isSpaceTextRoom = room.type === 3;
  if (!otherParticipant && !isNotesRoom && !isGroupRoom && !isSpaceTextRoom) return null;

  // Sending while reading older history jumps back to the live tail first (Discord's behaviour),
  // so the optimistic message lands at the present and its server echo - gated on hasMoreNewer -
  // actually confirms it instead of being dropped as belonging to the unloaded tail.
  if (messages.hasMoreNewer[roomId] === true) {
    await jumpToPresent(roomId);
  }

  const nonce = createTempId();
  const now = new Date().toISOString();
  // Optimistic previews straight from the local files, with a progress bar per upload.
  const tempAttachments: AttachmentView[] = pendingAttachments.map((p) => ({
    id: p.localId,
    url: p.previewUrl ?? '',
    filename: p.file.name || 'file',
    contentType: p.file.type || 'application/octet-stream',
    size: p.file.size,
    width: p.width,
    height: p.height,
    previewUrl: p.previewUrl,
    uploading: true,
    progress: 0,
  }));
  const tempMsg: DecryptedMessage = {
    id: nonce,
    room_id: roomId,
    sender_id: currentUserId,
    sender_device_id: '1',
    ciphertext: '',
    created_at: now,
    updated_at: now,
    plaintext,
    pending: true,
    reply_to_id: replyToId,
    attachments: tempAttachments,
  };

  setMessages('byRoom', roomId, (prev) => sortByCreatedAt([...(prev ?? []), tempMsg]));
  // Your own message always takes you to it, wherever you were reading (Discord's behaviour).
  setMessages('scrollToBottomForce', roomId, (t) => (t ?? 0) + 1);

  setMessages('sending', roomId, true);
  try {
    await ensureDevice(currentUserId);
    const deviceId = getCurrentDeviceId();
    if (!deviceId) throw new Error('E2EE device not initialized');
    const e2eeOff = roomE2EEOff(room, isGroupRoom, isSpaceTextRoom);

    // Never Number() either id: snowflakes are > 2^53, so a numeric id arrives at the
    // server rounded to the nearest 8 (every reply used to point at a message that
    // doesn't exist, and every message recorded a sender device that doesn't either).
    const input: CreateMessageInput = {
      sender_device_id: deviceId,
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    };

    // Uploads go first so the message can reference them by id. Plaintext rooms upload
    // the file as-is and the server records name/type/dimensions. E2EE rooms upload an
    // AES-GCM ciphertext blob the server can't interpret; the metadata and key travel
    // inside the Megolm-encrypted body below, so only people who can read the message can
    // open the file.
    const sentAttachments: AttachmentView[] = [];
    const encryptedMetas: EncryptedAttachmentMeta[] = [];
    if (pendingAttachments.length > 0) {
      input.attachments = [];
      for (const p of pendingAttachments) {
        const onProgress = (fraction: number) => setTempAttachmentProgress(roomId, nonce, p.localId, fraction);
        if (e2eeOff) {
          const a = await uploadAttachment(roomId, p.file, {
            filename: p.file.name,
            width: p.width,
            height: p.height,
            onProgress,
          });
          sentAttachments.push({ ...viewFromServerAttachment(a), previewUrl: p.previewUrl });
          input.attachments.push(a.id);
        } else {
          const { blob, material } = await encryptAttachment(p.file);
          const a = await uploadAttachment(roomId, blob, { encrypted: true, onProgress });
          const meta: EncryptedAttachmentMeta = {
            id: a.id,
            url: a.url,
            filename: p.file.name || 'file',
            content_type: p.file.type || 'application/octet-stream',
            size: p.file.size,
            width: p.width,
            height: p.height,
            key: material.key,
            iv: material.iv,
          };
          encryptedMetas.push(meta);
          sentAttachments.push({ ...viewFromEncryptedMeta(meta), previewUrl: p.previewUrl });
          input.attachments.push(a.id);
        }
      }
    }

    if (e2eeOff) {
      if (plaintext) input.plaintext = plaintext;
    } else {
      const memberUserIds = await resolveMemberUserIds(currentUserId, room, participants, isSpaceTextRoom);
      input.ciphertext = await encryptMessage(
        currentUserId,
        roomId,
        memberUserIds,
        plaintext,
        encryptedMetas.length > 0 ? { attachments: encryptedMetas } : undefined
      );
      input.mentions = extractMentionedUserIds(plaintext);
      input.mention_roles = extractMentionedRoleIds(plaintext);
      input.mention_everyone = mentionsEveryone(plaintext);
    }

    const msg = await createMessage(roomId, input);

    const confirmed: DecryptedMessage = { ...msg, plaintext, notEncrypted: e2eeOff, attachments: sentAttachments };
    let didReplaceInPlace = false;
    setMessages('byRoom', roomId, (prev) => {
      const list = prev ?? [];
      const tempIdx = list.findIndex((m) => m.id === nonce);
      const existingIdx = list.findIndex((m) => m.id === msg.id);
      if (existingIdx >= 0) {
        didReplaceInPlace = true;
        return list.map((m, i) => (i === existingIdx ? { ...m, ...confirmed, plaintext } : m));
      }
      if (tempIdx >= 0) {
        didReplaceInPlace = true;
        const merged = [...list];
        merged[tempIdx] = confirmed;
        return merged;
      }
      return sortByCreatedAt([...list, confirmed]);
    });
    if (!didReplaceInPlace) {
      setMessages('scrollToBottomForce', roomId, (t) => (t ?? 0) + 1);
    }
    return msg;
  } catch (err) {
    setMessages('byRoom', roomId, (prev) => (prev ?? []).filter((m) => m.id !== nonce));
    throw err;
  } finally {
    setMessages('sending', roomId, false);
  }
}

export function clearMessages(roomId?: string) {
  if (roomId) {
    setMessages('byRoom', roomId, []);
    // Don't leave a stale "viewing an old window" flag behind, or live messages would stop
    // appending to the reloaded room.
    setMessages('hasMoreNewer', roomId, false);
    setMessages('loadingNewer', roomId, false);
    setMessages('jumpTarget', roomId, null);
    forgetScrollPosition(roomId);
  } else {
    setMessages('byRoom', {});
    setMessages('hasMoreNewer', {});
    setMessages('loadingNewer', {});
    setMessages('jumpTarget', {});
  }
}

/** Add a message from Stargate MESSAGE_CREATE event */
export async function addMessageFromEvent(payload: {
  room_id: string;
  id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string;
  plaintext?: string;
  reply_to_id?: string;
  system_type?: string;
  system_payload?: string;
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}) {
  const roomId = payload.room_id;
  // The viewer has jumped to an older window (newer messages aren't loaded): a live message
  // belongs to the unloaded tail, so appending it here would splice a gap. It loads when they
  // scroll down to the tail or hit "jump to present". The handler still runs unread/notification
  // bookkeeping, so the sidebar badge and notifications are unaffected.
  if (messages.hasMoreNewer[roomId] === true) return;
  if (payload.system_type) {
    const msg: DecryptedMessage = {
      ...payload,
      plaintext: '',
      attachments: [],
    };
    let didAppend = false;
    setMessages('byRoom', roomId, (prev) => {
      const list = prev ?? [];
      if (list.some((m) => m.id === msg.id)) return list;
      didAppend = true;
      return sortByCreatedAt([...list, msg]);
    });
    if (didAppend) {
      setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
    }
    return;
  }
  removeTyping(roomId, String(payload.sender_id));
  const currentUserId = auth.user?.id;
  if (currentUserId) {
    try {
      await ensureDevice(currentUserId);
    } catch {
      // fall through; decrypt will fail and we'll set decryptError
    }
  }
  const resolved: ResolvedFields = currentUserId
    ? await resolvePlaintext(currentUserId, payload)
    : { plaintext: '', decryptError: true, attachments: [] };

  const msg: DecryptedMessage = { ...payload, ...resolved };
  let didReplaceInPlace = false;
  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const existingIdx = list.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      didReplaceInPlace = true;
      const existing = list[existingIdx]!;
      return list.map((m, i) => (i === existingIdx ? { ...existing, ...payload, ...preferResolved(existing, resolved) } : m));
    }
    const isOwn = String(payload.sender_id) === currentUserId;
    const tempIdx = isOwn
      ? list.findIndex(
          (m) => m.pending && String(m.sender_id) === currentUserId && m.plaintext === resolved.plaintext
        )
      : -1;
    if (tempIdx >= 0) {
      didReplaceInPlace = true;
      const merged = [...list];
      merged[tempIdx] = msg;
      return merged;
    }
    return sortByCreatedAt([...list, msg]);
  });
  if (!didReplaceInPlace) {
    setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
  }
}

/** Update a message from Stargate MESSAGE_UPDATE event */
export async function updateMessageFromEvent(payload: {
  room_id: string;
  id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string;
  plaintext?: string;
  reply_to_id?: string;
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}) {
  const roomId = payload.room_id;
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  const resolved = await resolvePlaintext(currentUserId, payload);

  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const idx = list.findIndex((m) => m.id === payload.id);
    if (idx < 0) return prev;
    const existing = list[idx]!;
    const updated: DecryptedMessage = { ...existing, ...payload, ...resolved };
    return list.map((m, i) => (i === idx ? updated : m));
  });
}

/** Remove a message from local store (Stargate MESSAGE_DELETE) */
export function removeMessageFromEvent(roomId: string, messageId: string) {
  setMessages('byRoom', roomId, (prev) => (prev ?? []).filter((m) => m.id !== messageId));
}

/**
 * Apply one reaction delta (one user added/removed one emoji) to a message's aggregated
 * summary in place. Only used for events about *other* users - the current user's own
 * add/remove goes through toggleReaction below, which applies its own optimistic delta and
 * then reconciles from the REST response's authoritative summary; applying this same delta
 * again from that action's own MESSAGE_REACTION_ADD/REMOVE echo would double-count it.
 *
 * Written with `produce`, not `list.map((m, i) => i === idx ? { ...m, reactions } : m)`.
 * The message list is rendered through `<For>`, which keys rows by object identity, so
 * handing it a fresh message object (even with an untouched `attachments` array copied
 * across) disposes that row and builds a new one. Every attachment inside it remounts, its
 * resource refetches, its skeleton comes back and the `<img>` is recreated - so adding a
 * reaction to a message with a photo made the photo visibly reload. Mutating only the
 * `reactions` field leaves the message (and its attachments) identical by reference, and the
 * row is updated instead of rebuilt.
 */
function patchReaction(roomId: string, messageId: string, emoji: string, userId: string, added: boolean) {
  const currentUserId = auth.user?.id;
  setMessages(
    'byRoom',
    roomId,
    produce((prev) => {
      const list = prev ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      const msg = list[idx]!;
      const reactions = msg.reactions ?? [];
      const ri = reactions.findIndex((r) => r.emoji === emoji);
      if (added) {
        if (ri >= 0) {
          const r = reactions[ri]!;
          r.count += 1;
          if (userId === currentUserId) r.me = true;
        } else {
          msg.reactions = [...reactions, { emoji, count: 1, me: userId === currentUserId }];
        }
      } else {
        if (ri < 0) return;
        const r = reactions[ri]!;
        const count = r.count - 1;
        if (count <= 0) {
          msg.reactions = reactions.filter((_, i) => i !== ri);
        } else {
          r.count = count;
          if (userId === currentUserId) r.me = false;
        }
      }
    })
  );
}

/**
 * Toggle the current user's own reaction: applies an optimistic delta immediately, calls
 * the API, then replaces the message's reaction summary with the authoritative one the
 * response carries. Reverts the optimistic delta if the request fails.
 */
export async function toggleReaction(roomId: string, messageId: string, emoji: string, currentlyMine: boolean): Promise<void> {
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  patchReaction(roomId, messageId, emoji, currentUserId, !currentlyMine);
  try {
    const res = currentlyMine
      ? await removeReactionApi(roomId, messageId, emoji)
      : await addReactionApi(roomId, messageId, emoji);
    // Same reasoning as patchReaction: write just the `reactions` field so the message row
    // is patched in place rather than remounted.
    setMessages(
      'byRoom',
      roomId,
      produce((prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((m) => m.id === messageId);
        if (idx < 0) return;
        list[idx]!.reactions = res.reactions;
      })
    );
  } catch (err) {
    patchReaction(roomId, messageId, emoji, currentUserId, currentlyMine);
    throw err;
  }
}

/** Edit a message: encrypt, PATCH, update local store. Realtime MESSAGE_UPDATE will also update others. */
export async function editMessage(
  roomId: string,
  msgId: string,
  newPlaintext: string
): Promise<Message | null> {
  const room = rooms.rooms.find((r) => r.id === roomId);
  const currentUserId = auth.user?.id;
  if (!room || !currentUserId) return null;

  const participants = room.participants ?? [];
  const otherParticipant = participants.find((p) => p.id !== currentUserId);
  const isNotesRoom = !otherParticipant && participants.length === 1;
  const isGroupRoom = room.type === 2 && participants.length >= 2;
  const isSpaceTextRoom = room.type === 3;
  if (!otherParticipant && !isNotesRoom && !isGroupRoom && !isSpaceTextRoom) return null;

  try {
    await ensureDevice(currentUserId);
    const e2eeOff = roomE2EEOff(room, isGroupRoom, isSpaceTextRoom);
    const existing = messages.byRoom[roomId]?.find((m) => m.id === msgId);
    // An E2EE edit re-encrypts the whole body, so the attachment metadata/keys that live
    // in it have to be carried over or every other reader would lose the files.
    const encryptedMetas = (existing?.attachments ?? [])
      .map(encryptedMetaFromView)
      .filter((m): m is EncryptedAttachmentMeta => m != null);

    const msg = e2eeOff
      ? await editMessageApi(roomId, msgId, { plaintext: newPlaintext })
      : await editMessageApi(roomId, msgId, {
          ciphertext: await encryptMessage(
            currentUserId,
            roomId,
            await resolveMemberUserIds(currentUserId, room, participants, isSpaceTextRoom),
            newPlaintext,
            encryptedMetas.length > 0 ? { attachments: encryptedMetas } : undefined
          ),
        });

    const updated: DecryptedMessage = {
      ...msg,
      plaintext: newPlaintext,
      notEncrypted: e2eeOff,
      attachments: existing?.attachments ?? (msg.attachments ?? []).filter((a) => !a.encrypted).map(viewFromServerAttachment),
    };
    setMessages('byRoom', roomId, (prev) => {
      const list = prev ?? [];
      const idx = list.findIndex((m) => m.id === msgId);
      if (idx < 0) return prev;
      return list.map((m, i) => (i === idx ? { ...m, ...updated } : m));
    });
    return msg;
  } catch (err) {
    console.error('Edit message failed:', err);
    throw err;
  }
}

/**
 * Bump the local mention badge when an incoming message pings the current user - the
 * server already incremented room_mention_counts (so a reload/other device sees it
 * regardless), this just makes the sidebar react immediately without waiting for one.
 * Mirrors the server's own notify-set rule (messages.Service.resolveMentionNotifySet):
 * direct mention OR @everyone/@here, never for your own messages.
 */
function applyIncomingMentionSignal(roomId: string, data: Record<string, unknown>) {
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  const senderId = data.sender_id != null ? String(data.sender_id) : '';
  if (senderId === currentUserId) return;
  const mentions = Array.isArray(data.mentions) ? (data.mentions as unknown[]).map(String) : [];
  const everyone = data.mention_everyone === true;
  if (!everyone && !mentions.includes(currentUserId)) return;
  setReadState('byRoom', roomId, (prev) => ({
    lastReadMessageId: prev?.lastReadMessageId ?? null,
    mentionCount: (prev?.mentionCount ?? 0) + 1,
  }));
}

/** Register Stargate event handlers. Call once on app init. */
export function initStargateMessageHandler() {
  return onStargateEvent((evt) => {
    if (evt.t === 'MESSAGE_CREATE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const rawRoomId = data?.room_id ?? (evt as { room_id?: string | number }).room_id;
      const roomId = rawRoomId != null ? String(rawRoomId) : '';
      if (data && roomId) {
        const rawMsgId = data?.id;
        const msgId = rawMsgId != null ? String(rawMsgId) : '';
        // Notify once the message (and, in E2EE rooms, its plaintext) is in the store.
        void addMessageFromEvent({ ...data, room_id: roomId } as Parameters<typeof addMessageFromEvent>[0]).then(() => {
          if (msgId) maybeNotifyMessage(roomId, msgId);
        });
        applyIncomingMentionSignal(roomId, data);
        if (msgId) {
          updateRoomLastMessage(roomId, msgId);
          updateSpaceRoomLastMessage(roomId, msgId);
        }
      }
    } else if (evt.t === 'MESSAGE_UPDATE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const rawRoomId = data?.room_id ?? (evt as { room_id?: string | number }).room_id;
      const roomId = rawRoomId != null ? String(rawRoomId) : '';
      if (data && roomId) {
        updateMessageFromEvent({ ...data, room_id: roomId } as Parameters<typeof updateMessageFromEvent>[0]);
      }
    } else if (evt.t === 'MESSAGE_DELETE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const rawRoomId = data?.room_id ?? (evt as { room_id?: string | number }).room_id;
      const roomId = rawRoomId != null ? String(rawRoomId) : '';
      const rawMessageId = data?.message_id ?? (data as { id?: string | number }).id;
      const messageId = rawMessageId != null ? String(rawMessageId) : '';
      if (roomId && messageId) {
        removeMessageFromEvent(roomId, messageId);
      }
    } else if (evt.t === 'MESSAGE_REACTION_ADD' || evt.t === 'MESSAGE_REACTION_REMOVE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const roomId = data?.room_id != null ? String(data.room_id) : '';
      const messageId = data?.message_id != null ? String(data.message_id) : '';
      const userId = data?.user_id != null ? String(data.user_id) : '';
      const emoji = typeof data?.emoji === 'string' ? data.emoji : '';
      // Our own reactions are already applied (optimistically, then reconciled) by
      // toggleReaction - applying this echo too would double-count them.
      if (roomId && messageId && userId && emoji && userId !== auth.user?.id) {
        patchReaction(roomId, messageId, emoji, userId, evt.t === 'MESSAGE_REACTION_ADD');
      }
    }
  });
}
