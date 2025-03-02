export interface CachedMessage {
  id?: string;
  nonce?: string;
  content: string;
  author_id: string;
  room_id: string;
  created_at?: string;
  edited_at?: string;
  sending?: boolean;
  failed?: boolean;
  pending?: boolean;
  error?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type: string;
    size: number;
    url: string;
  }>;
}

export class MessageCache {
  private messages: Map<string, Map<string, CachedMessage>> = new Map();
  private messageUpdateCallbacks: ((roomId: string, message: CachedMessage) => void)[] = [];
  private readonly MAX_MESSAGES_PER_ROOM = 50;

  public setMessages(roomId: string, messages: CachedMessage[]) {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, new Map());
    }

    const roomMessages = this.messages.get(roomId)!;
    messages.forEach(message => {
      roomMessages.set(message.id || message.nonce || '', message);
    });

    // Trim messages if they exceed the limit
    if (roomMessages.size > this.MAX_MESSAGES_PER_ROOM) {
      const messagesToDelete = Array.from(roomMessages.entries())
        .slice(0, roomMessages.size - this.MAX_MESSAGES_PER_ROOM);
      messagesToDelete.forEach(([key]) => roomMessages.delete(key));
    }
  }

  public getMessages(roomId: string): CachedMessage[] {
    return Array.from(this.messages.get(roomId)?.values() || []);
  }

  public getMessage(roomId: string, messageId: string): CachedMessage | undefined {
    return this.messages.get(roomId)?.get(messageId);
  }

  public addMessage(roomId: string, message: CachedMessage) {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, new Map());
    }

    const roomMessages = this.messages.get(roomId)!;
    const messageId = message.id || message.nonce || '';
    roomMessages.set(messageId, message);

    // Notify callbacks of message update
    this.messageUpdateCallbacks.forEach(callback => {
      callback(roomId, message);
    });

    // Trim messages if they exceed the limit
    if (roomMessages.size > this.MAX_MESSAGES_PER_ROOM) {
      const oldestMessage = Array.from(roomMessages.entries())[0];
      if (oldestMessage) {
        roomMessages.delete(oldestMessage[0]);
      }
    }
  }

  public updateMessage(roomId: string, messageId: string, updates: Partial<CachedMessage>) {
    const roomMessages = this.messages.get(roomId);
    if (!roomMessages) return;

    const existingMessage = roomMessages.get(messageId);
    if (!existingMessage) return;

    const updatedMessage = { ...existingMessage, ...updates };
    roomMessages.set(messageId, updatedMessage);

    // Notify callbacks of message update
    this.messageUpdateCallbacks.forEach(callback => {
      callback(roomId, updatedMessage);
    });
  }

  public deleteMessage(roomId: string, messageId: string) {
    const roomMessages = this.messages.get(roomId);
    if (!roomMessages) return;

    roomMessages.delete(messageId);
  }

  public onMessageUpdate(callback: (roomId: string, message: CachedMessage) => void) {
    this.messageUpdateCallbacks.push(callback);
    return callback; // Return the callback for easier removal
  }

  public offMessageUpdate(callback: (roomId: string, message: CachedMessage) => void) {
    const index = this.messageUpdateCallbacks.indexOf(callback);
    if (index !== -1) {
      this.messageUpdateCallbacks.splice(index, 1);
    }
  }

  public clear() {
    this.messages.clear();
  }
}