import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import type { AttachmentDraft, PendingAttachment } from '../../lib/attachments/draft';

/** What a room's composer held when you left it. */
interface StashedDraft {
  text: string;
  files: PendingAttachment[];
  replyTo: string | null;
  error: string;
}

export interface RoomDraftsOptions {
  /** The room on screen. */
  roomId: Accessor<string | undefined>;
  draft: Accessor<string>;
  setDraft: (text: string) => void;
  setCursorPos: (pos: number) => void;
  attachments: AttachmentDraft;
  replyTo: Accessor<string | null>;
  setReplyTo: (id: string | null) => void;
}

/**
 * Gives every room its own composer: the text, queued files and reply you leave in one room
 * wait there until you come back, and the next room starts from whatever it had.
 *
 * The router reuses RoomPage and SpacePage when only the room in the URL changes, so their
 * page-level draft signals simply carried over: a half-written message and a file attached in
 * one PM sat in the next PM's composer, one Enter away from going to the wrong person, and a
 * reply started in one room was sent as a reply in another.
 *
 * The stash lives as long as the page does. Its files' preview URLs are released with it.
 */
export function createRoomDrafts(opts: RoomDraftsOptions) {
  const stash = new Map<string, StashedDraft>();
  let current = untrack(opts.roomId);
  let disposed = false;

  function show(saved: StashedDraft | undefined) {
    const text = saved?.text ?? '';
    opts.setDraft(text);
    opts.setCursorPos(text.length);
    opts.attachments.clear();
    if (saved?.files.length) opts.attachments.restore(saved.files);
    opts.attachments.setError(saved?.error ?? '');
    opts.setReplyTo(saved?.replyTo ?? null);
  }

  // Compared by hand rather than with on(..., { defer: true }): a deferred `on` never records
  // the input of the run it skips, so the first switch would not know which room it left.
  createEffect(() => {
    const id = opts.roomId();
    if (id === current) return;
    const left = current;
    current = id;
    untrack(() => {
      if (left) {
        const error = opts.attachments.error();
        const files = opts.attachments.take();
        const text = opts.draft();
        const replyTo = opts.replyTo();
        if (text || files.length || replyTo) stash.set(left, { text, files, replyTo, error });
        else stash.delete(left);
      }
      const saved = id ? stash.get(id) : undefined;
      if (id) stash.delete(id);
      show(saved);
    });
  });

  onCleanup(() => {
    disposed = true;
    for (const saved of stash.values()) {
      for (const f of saved.files) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    }
    stash.clear();
  });

  /**
   * Hand a message that failed to send back to the composer it came from: the one on screen,
   * or that room's stash if you have moved on while it was in flight - never the composer of
   * whatever room you are looking at now.
   */
  function restoreFailedSend(roomId: string, text: string, files: PendingAttachment[], error: string) {
    if (disposed) return;
    if (roomId === current) {
      opts.setDraft(text);
      opts.attachments.restore(files);
      opts.attachments.setError(error);
      return;
    }
    const saved = stash.get(roomId);
    stash.set(roomId, {
      // Keep anything typed there since, after the message that bounced.
      text: [text, saved?.text].filter(Boolean).join('\n'),
      files: [...files, ...(saved?.files ?? [])],
      replyTo: saved?.replyTo ?? null,
      error,
    });
  }

  /**
   * Queue files in the composer of the room they were added in.
   *
   * The queue measures every image before it appends anything, so it appends to whichever room
   * is on screen by the time it has finished. Photos dropped or pasted just before clicking
   * into another PM landed in that PM's composer, one Enter away from going to the wrong
   * person, after the swap had already run. So when an add settles in another room, its files
   * are picked back out - by File, a fresh object for every drop, paste, pick and recording -
   * and go to the stash of the room they came from, along with whatever the queue said about
   * them (too large, too many).
   */
  async function addFiles(files: Iterable<File>) {
    const list = [...files];
    const startedIn = current;
    await opts.attachments.addFiles(list);
    if (disposed) {
      // The page went away mid-add: anything queued now has no composer left to show it.
      opts.attachments.clear();
      return;
    }
    if (current === startedIn) return;
    const added = new Set(list);
    const queued = opts.attachments.items();
    const strays = queued.filter((p) => added.has(p.file));
    // Nothing of this add is in this room's queue: it finished before the room changed, and the
    // swap already took its files along.
    if (strays.length === 0) return;
    // Read before take(), which clears it: it describes these files, not the room on screen.
    const problem = opts.attachments.error();
    opts.attachments.take();
    opts.attachments.restore(queued.filter((p) => !added.has(p.file)));
    if (!startedIn) {
      for (const f of strays) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return;
    }
    const saved = stash.get(startedIn);
    stash.set(startedIn, {
      text: saved?.text ?? '',
      files: [...(saved?.files ?? []), ...strays],
      replyTo: saved?.replyTo ?? null,
      error: problem || saved?.error || '',
    });
  }

  return { restoreFailedSend, addFiles };
}
