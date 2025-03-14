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
  deleted?: boolean;
  message_references?: string[];
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
  private deletedMessageIds: Map<string, Set<string>> = new Map(); // Track deleted message IDs by room
  private readonly MAX_MESSAGES_PER_ROOM = 50;
  private readonly DELETED_MESSAGES_STORAGE_KEY = 'sc_deleted_messages';

  constructor() {
    this.loadDeletedMessagesFromStorage();
  }

  public setMessages(roomId: string, messages: CachedMessage[]) {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, new Map());
    }

    const roomMessages = this.messages.get(roomId)!;
    const deletedIds = this.getDeletedMessageIds(roomId);
    
    // First, clear any existing messages that are in the deleted list
    Array.from(roomMessages.keys()).forEach(existingId => {
      if (deletedIds.has(existingId)) {
        roomMessages.delete(existingId);
      }
    });
    
    messages.forEach(message => {
      const messageId = message.id || message.nonce || '';
      // Only add messages that haven't been deleted
      if (messageId && !deletedIds.has(messageId)) {
        roomMessages.set(messageId, message);
      } else if (messageId && deletedIds.has(messageId)) {
        console.log(`[MessageCache] Skipping deleted message in setMessages: ${messageId}`);
      }
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
    
    // Check if this message has been deleted before
    const deletedIds = this.getDeletedMessageIds(roomId);
    if (messageId && deletedIds.has(messageId)) {
      console.log(`[MessageCache] Skipping deleted message: ${messageId}`);
      return;
    }
    
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

    const existingMessage = roomMessages.get(messageId);
    if (!existingMessage) return;

    // Remove from the messages map
    roomMessages.delete(messageId);
    
    // Add to the deleted messages tracking
    this.addDeletedMessageId(roomId, messageId);
    
    console.log(`[MessageCache] Deleted message ${messageId} from room ${roomId} and added to deleted list`);

    // Notify callbacks of message deletion
    this.messageUpdateCallbacks.forEach(callback => {
      callback(roomId, { ...existingMessage, deleted: true });
    });
  }

  private getDeletedMessageIds(roomId: string): Set<string> {
    if (!this.deletedMessageIds.has(roomId)) {
      this.deletedMessageIds.set(roomId, new Set());
    }
    return this.deletedMessageIds.get(roomId)!;
  }

  private addDeletedMessageId(roomId: string, messageId: string): void {
    const deletedIds = this.getDeletedMessageIds(roomId);
    deletedIds.add(messageId);
    this.saveDeletedMessagesToStorage();
  }

  private saveDeletedMessagesToStorage(): void {
    try {
      // Convert Map<string, Set<string>> to a serializable object
      const serializable: Record<string, string[]> = {};
      this.deletedMessageIds.forEach((ids, roomId) => {
        serializable[roomId] = Array.from(ids);
      });
      localStorage.setItem(this.DELETED_MESSAGES_STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error('[MessageCache] Failed to save deleted messages to storage:', error);
    }
  }

  private loadDeletedMessagesFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.DELETED_MESSAGES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string[]>;
        Object.entries(parsed).forEach(([roomId, ids]) => {
          const set = new Set(ids);
          this.deletedMessageIds.set(roomId, set);
        });
        console.log('[MessageCache] Loaded deleted messages from storage:', this.deletedMessageIds);
      }
    } catch (error) {
      console.error('[MessageCache] Failed to load deleted messages from storage:', error);
    }
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
    this.deletedMessageIds.clear();
    localStorage.removeItem(this.DELETED_MESSAGES_STORAGE_KEY);
  }
}