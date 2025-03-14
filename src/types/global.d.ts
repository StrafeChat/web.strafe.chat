import { MessageCache } from "../lib/cache/MessageCache";
import { Clientuser } from "../lib/providers/auth/AuthProvider";
import { RoomWithRecipients } from "../types/rooms";

declare global {
  interface Window {
    messageCache: MessageCache;
    setUnreadMessages: (unreads: { [roomId: string]: string[] } | ((prev: { [roomId: string]: string[] }) => { [roomId: string]: string[] })) => void;
    setRooms: (updater: (rooms: RoomWithRecipients[]) => RoomWithRecipients[]) => void;
    getCurrentUser: () => Clientuser | null;
    getCurrentRooms: () => RoomWithRecipients[];
  }
}