import { Message } from "../../types/messages";
import { Room } from "../../types/rooms";

export class RoomCache {
  private rooms: Map<string, Room> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private readonly MAX_MESSAGES = 50;

  // Add or update a room in the cache
  public setRoom(room: Room): void {
    this.rooms.set(room.id, room);
  }

  // Get a room from the cache
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // Add a message to a room's message cache
  public addMessage(roomId: string, message: Message): void {
    let roomMessages = this.messages.get(roomId) || [];
    
    // Add new message to the beginning of the array
    roomMessages.unshift(message);
    
    // Trim to max messages
    if (roomMessages.length > this.MAX_MESSAGES) {
      roomMessages = roomMessages.slice(0, this.MAX_MESSAGES);
    }
    
    this.messages.set(roomId, roomMessages);

    // Update room's last message
    const room = this.rooms.get(roomId);
    if (room) {
      room.last_message_id = message.id;
      this.rooms.set(roomId, room);
    }
  }

  // Get cached messages for a room
  public getMessages(roomId: string): Message[] {
    return this.messages.get(roomId) || [];
  }

  // Check if messages are cached for a room
  public hasMessages(roomId: string): boolean {
    return this.messages.has(roomId);
  }

  // Clear messages for a room
  public clearMessages(roomId: string): void {
    this.messages.delete(roomId);
  }

  // Clear all caches
  public clear(): void {
    this.rooms.clear();
    this.messages.clear();
  }
}