/**
 * Where the viewer left each room, so coming back lands them on the same message instead of
 * at the bottom (Discord keeps a channel's scroll position for the session). Kept outside the
 * message store on purpose: it is read once on entry and never drives rendering.
 */
export interface SavedScrollPosition {
  /** Top-most row that was on screen, and where its top edge sat relative to the viewport. */
  anchorId: string | null;
  top: number;
  /** The viewer was following the newest message - land at the bottom again, not on the row. */
  atBottom: boolean;
}

const positions = new Map<string, SavedScrollPosition>();

export function rememberScrollPosition(roomId: string, pos: SavedScrollPosition): void {
  positions.set(roomId, pos);
}

export function recallScrollPosition(roomId: string): SavedScrollPosition | undefined {
  return positions.get(roomId);
}

/** The room's loaded window is being replaced or cleared, so the saved row may no longer exist. */
export function forgetScrollPosition(roomId: string): void {
  positions.delete(roomId);
}
