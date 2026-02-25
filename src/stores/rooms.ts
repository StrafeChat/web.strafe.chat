import { createStore } from 'solid-js/store';
import { listRooms, type Room } from '../api/rooms';

export interface RoomsState {
  rooms: Room[];
  loading: boolean;
  hydrated: boolean;
}

export const [rooms, setRooms] = createStore<RoomsState>({
  rooms: [],
  loading: false,
  hydrated: false,
});

export async function loadRooms(): Promise<void> {
  setRooms({ loading: true });
  try {
    const list = await listRooms();
    setRooms({ rooms: list, loading: false, hydrated: true });
  } catch {
    setRooms({ loading: false, hydrated: true });
  }
}

export function clearRooms() {
  setRooms({ rooms: [], loading: false, hydrated: false });
}

/** Display name for a PM: other participant's name, or room name, or fallback */
export function roomDisplayName(room: Room, currentUserId: string): string {
  if (room.name) return room.name;
  if (room.participants?.length) {
    const other = room.participants.find((p) => p.id !== currentUserId);
    if (other) return other.display_name || other.username || 'Unknown';
  }
  return 'Unknown';
}
