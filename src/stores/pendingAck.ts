/** Pending ack for page unload (refresh/close). RoomPage updates this when viewing a room. */
let pending: { roomId: string; messageId: string } | null = null;

export function setPendingAck(roomId: string, messageId: string) {
  pending = { roomId, messageId };
}

export function clearPendingAck() {
  pending = null;
}

export function getPendingAck() {
  return pending;
}
