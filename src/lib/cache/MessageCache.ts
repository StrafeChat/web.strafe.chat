import { MessageType, SystemMessageType } from "../../types/messageTypes";

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
  reactions?: Record<
    string,
    {
      count: number;
      users: string[];
    }
  >;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    height?: number;
    width?: number;
    user_id: string;
  }>;
  type?: MessageType;
  system_type?: SystemMessageType;
  system_data?: {
    user_id?: string;
    actor_id?: string;
    old_value?: string;
    new_value?: string;
    extra_data?: any;
  };
}

export class MessageCache {
  private messages: Map<string, Map<string, CachedMessage>> = new Map();
  private messageUpdateCallbacks: ((
    roomId: string,
    message: CachedMessage,
  ) => void)[] = [];
  private deletedMessageIds: Map<string, Set<string>> = new Map(); // Track deleted message IDs by room
  private readonly MAX_MESSAGES_PER_ROOM = 200; // Increased to 200 to reduce message loss
  private readonly DELETED_MESSAGES_STORAGE_KEY = "sc_deleted_messages";
  // Track the oldest and newest message IDs for each room
  private oldestMessageIds: Map<string, string> = new Map();
  private newestMessageIds: Map<string, string> = new Map();
  // Track if we've reached the beginning or end of message history
  private reachedBeginning: Map<string, boolean> = new Map();
  private reachedEnd: Map<string, boolean> = new Map();
  // Track when messages were last fetched for each room
  private lastFetchTimes: Map<string, number> = new Map();

  constructor() {
    this.loadDeletedMessagesFromStorage();
  }

  public setMessages(
    roomId: string,
    messages: CachedMessage[],
    position: "newer" | "older" | "replace" = "replace",
  ) {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, new Map());
    }

    const roomMessages = this.messages.get(roomId)!;
    const deletedIds = this.getDeletedMessageIds(roomId);

    // First, clear any existing messages that are in the deleted list
    Array.from(roomMessages.keys()).forEach((existingId) => {
      if (deletedIds.has(existingId)) {
        roomMessages.delete(existingId);
      }
    });

    // If this is a replacement, clear existing messages
    if (position === "replace") {
      roomMessages.clear();
      this.reachedBeginning.set(roomId, false);
      this.reachedEnd.set(roomId, false);
    }

    // Sort messages by creation date to ensure correct order
    const sortedMessages = [...messages].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    // If we received fewer messages than requested, we've reached a boundary
    if (sortedMessages.length < 50) {
      if (position === "older") {
        this.reachedBeginning.set(roomId, true);
      } else if (position === "newer") {
        this.reachedEnd.set(roomId, true);
      }
    }

    // Update oldest/newest message IDs if applicable
    if (sortedMessages.length > 0) {
      const firstMessage = sortedMessages[0];
      const lastMessage = sortedMessages[sortedMessages.length - 1];

      if (position === "older" || position === "replace") {
        const firstMessageId = firstMessage.id || "";
        if (firstMessageId) {
          this.oldestMessageIds.set(roomId, firstMessageId);
        }
      }

      if (position === "newer" || position === "replace") {
        const lastMessageId = lastMessage.id || "";
        if (lastMessageId) {
          this.newestMessageIds.set(roomId, lastMessageId);
        }
      }
    }

    sortedMessages.forEach((message) => {
      const messageId = message.id || message.nonce || "";
      // Only add messages that haven't been deleted
      if (messageId && !deletedIds.has(messageId)) {
        roomMessages.set(messageId, message);
      } else if (messageId && deletedIds.has(messageId)) {
        console.log(
          `[MessageCache] Skipping deleted message in setMessages: ${messageId}`,
        );
      }
    });

    // Trim messages if they exceed the limit (more conservative approach)
    const TRIM_THRESHOLD = this.MAX_MESSAGES_PER_ROOM + 50; // Allow some buffer before trimming
    const TRIM_TARGET = this.MAX_MESSAGES_PER_ROOM - 25; // Trim to 25 messages below the limit

    if (roomMessages.size > TRIM_THRESHOLD) {
      // If we're adding older messages, remove newer ones
      if (position === "older") {
        const messagesToDelete = Array.from(roomMessages.entries())
          .sort((a, b) => {
            const dateA = a[1].created_at
              ? new Date(a[1].created_at).getTime()
              : 0;
            const dateB = b[1].created_at
              ? new Date(b[1].created_at).getTime()
              : 0;
            return dateB - dateA; // Sort newest first
          })
          .slice(0, roomMessages.size - TRIM_TARGET);
        messagesToDelete.forEach(([key]) => roomMessages.delete(key));
      } else {
        // Otherwise remove older messages
        const messagesToDelete = Array.from(roomMessages.entries())
          .sort((a, b) => {
            const dateA = a[1].created_at
              ? new Date(a[1].created_at).getTime()
              : 0;
            const dateB = b[1].created_at
              ? new Date(b[1].created_at).getTime()
              : 0;
            return dateA - dateB; // Sort oldest first
          })
          .slice(0, roomMessages.size - TRIM_TARGET);
        messagesToDelete.forEach(([key]) => roomMessages.delete(key));
      }
    }

    // Update the last fetch time for this room
    this.setLastFetchTime(roomId);

    console.log(
      `[MessageCache] Set ${sortedMessages.length} messages for room ${roomId} (position: ${position})`,
    );
  }

  public getMessages(roomId: string): CachedMessage[] {
    return Array.from(this.messages.get(roomId)?.values() || []);
  }

  public hasMessages(roomId: string): boolean {
    const roomMessages = this.messages.get(roomId);
    return roomMessages ? roomMessages.size > 0 : false;
  }

  public getMessageCount(roomId: string): number {
    const roomMessages = this.messages.get(roomId);
    return roomMessages ? roomMessages.size : 0;
  }

  public getMessage(
    roomId: string,
    messageId: string,
  ): CachedMessage | undefined {
    return this.messages.get(roomId)?.get(messageId);
  }

  public addMessage(roomId: string, message: CachedMessage) {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, new Map());
    }

    const roomMessages = this.messages.get(roomId)!;

    // For temporary messages, always use nonce as the key
    // For confirmed messages, use ID as the key
    const messageKey = message.id || message.nonce || "";

    // Check if this message has been deleted before
    const deletedIds = this.getDeletedMessageIds(roomId);
    if (messageKey && deletedIds.has(messageKey)) {
      console.log(`[MessageCache] Skipping deleted message: ${messageKey}`);
      return;
    }

    // Check if we're trying to add a message that already exists with same nonce
    if (message.nonce) {
      const existingByNonce = Array.from(roomMessages.values()).find(
        (m) => m.nonce === message.nonce,
      );
      if (existingByNonce) {
        console.log(
          `[MessageCache] Message with nonce ${message.nonce} already exists, updating instead`,
        );
        const existingKey = existingByNonce.id || existingByNonce.nonce || "";
        this.updateMessage(roomId, existingKey, message);
        return;
      }
    }

    // Check for existing message with same ID to prevent duplicates
    if (message.id && roomMessages.has(message.id)) {
      console.log(
        `[MessageCache] Message with ID ${message.id} already exists, updating instead`,
      );
      this.updateMessage(roomId, message.id, message);
      return;
    }

    roomMessages.set(messageKey, message);
    console.log(
      `[MessageCache] Added message with key: ${messageKey}, nonce: ${message.nonce}, id: ${message.id}`,
    );

    // Notify callbacks of message update
    this.messageUpdateCallbacks.forEach((callback) => {
      callback(roomId, message);
    });

    // Trim messages if they exceed the limit (conservative approach)
    const TRIM_THRESHOLD = this.MAX_MESSAGES_PER_ROOM + 50;
    if (roomMessages.size > TRIM_THRESHOLD) {
      // Remove older messages to make room
      const messagesToDelete = Array.from(roomMessages.entries())
        .sort((a, b) => {
          const dateA = a[1].created_at
            ? new Date(a[1].created_at).getTime()
            : 0;
          const dateB = b[1].created_at
            ? new Date(b[1].created_at).getTime()
            : 0;
          return dateA - dateB; // Sort oldest first
        })
        .slice(0, 25); // Remove 25 oldest messages
      messagesToDelete.forEach(([key]) => roomMessages.delete(key));
    }
  }

  public updateMessage(
    roomId: string,
    messageKey: string,
    updates: Partial<CachedMessage>,
  ) {
    const roomMessages = this.messages.get(roomId);
    if (!roomMessages) return;

    let existingMessage = roomMessages.get(messageKey);
    let actualKey = messageKey;

    // If not found by key, try to find by nonce
    if (!existingMessage && updates.nonce) {
      const foundEntry = Array.from(roomMessages.entries()).find(
        ([_, msg]) => msg.nonce === updates.nonce,
      );
      if (foundEntry) {
        actualKey = foundEntry[0];
        existingMessage = foundEntry[1];
      }
    }

    if (!existingMessage) {
      console.log(`[MessageCache] Message not found for update: ${messageKey}`);
      return;
    }

    const updatedMessage = { ...existingMessage, ...updates };

    // Handle transition from temporary (nonce-keyed) to confirmed (ID-keyed) message
    if (updates.id && !existingMessage.id && existingMessage.nonce) {
      // This is a temporary message being confirmed with a real ID
      // Remove the old entry with nonce key
      roomMessages.delete(actualKey);
      // Add the updated message with the new ID key
      roomMessages.set(updates.id, updatedMessage);
      console.log(
        `[MessageCache] Transitioned message from nonce ${existingMessage.nonce} to ID ${updates.id}`,
      );
    } else {
      // Regular in-place update
      roomMessages.set(actualKey, updatedMessage);
      console.log(`[MessageCache] Updated message in-place: ${actualKey}`);
    }

    // Notify callbacks of message update
    this.messageUpdateCallbacks.forEach((callback) => {
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

    console.log(
      `[MessageCache] Deleted message ${messageId} from room ${roomId} and added to deleted list`,
    );

    // Notify callbacks of message deletion
    this.messageUpdateCallbacks.forEach((callback) => {
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
      localStorage.setItem(
        this.DELETED_MESSAGES_STORAGE_KEY,
        JSON.stringify(serializable),
      );
    } catch (error) {
      console.error(
        "[MessageCache] Failed to save deleted messages to storage:",
        error,
      );
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
        console.log(
          "[MessageCache] Loaded deleted messages from storage:",
          this.deletedMessageIds,
        );
      }
    } catch (error) {
      console.error(
        "[MessageCache] Failed to load deleted messages from storage:",
        error,
      );
    }
  }

  public onMessageUpdate(
    callback: (roomId: string, message: CachedMessage) => void,
  ) {
    this.messageUpdateCallbacks.push(callback);
    return callback; // Return the callback for easier removal
  }

  public offMessageUpdate(
    callback: (roomId: string, message: CachedMessage) => void,
  ) {
    const index = this.messageUpdateCallbacks.indexOf(callback);
    if (index !== -1) {
      this.messageUpdateCallbacks.splice(index, 1);
    }
  }

  // Update message by nonce - convenience method for temporary messages
  public updateMessageByNonce(
    roomId: string,
    nonce: string,
    updates: Partial<CachedMessage>,
  ) {
    const roomMessages = this.messages.get(roomId);
    if (!roomMessages) {
      console.log(`[MessageCache] Room ${roomId} not found for nonce update`);
      return;
    }

    // Find message by nonce
    let foundKey: string | null = null;
    let foundMessage: CachedMessage | null = null;

    for (const [key, message] of roomMessages.entries()) {
      if (message.nonce === nonce) {
        foundKey = key;
        foundMessage = message;
        break;
      }
    }

    if (!foundKey || !foundMessage) {
      console.log(
        `[MessageCache] Message with nonce ${nonce} not found for update`,
      );
      return;
    }

    const updatedMessage = { ...foundMessage, ...updates };

    // Handle transition from temporary (nonce-keyed) to confirmed (ID-keyed) message
    if (updates.id && !foundMessage.id) {
      // This is a temporary message being confirmed with a real ID
      // Remove the old entry with nonce key
      roomMessages.delete(foundKey);
      // Add the updated message with the new ID key
      roomMessages.set(updates.id, updatedMessage);
      console.log(
        `[MessageCache] updateMessageByNonce: Transitioned message from nonce ${nonce} (key: ${foundKey}) to ID ${updates.id}`,
      );
    } else {
      // Regular in-place update
      roomMessages.set(foundKey, updatedMessage);
      console.log(
        `[MessageCache] updateMessageByNonce: Updated message in-place with key: ${foundKey}`,
      );
    }

    // Notify callbacks of message update
    this.messageUpdateCallbacks.forEach((callback) => {
      callback(roomId, updatedMessage);
    });
  }

  public clear() {
    this.messages.clear();
    this.deletedMessageIds.clear();
    localStorage.removeItem(this.DELETED_MESSAGES_STORAGE_KEY);
  }

  // Get the oldest message ID for a room
  public getOldestMessageId(roomId: string): string | undefined {
    return this.oldestMessageIds.get(roomId);
  }

  // Get the newest message ID for a room
  public getNewestMessageId(roomId: string): string | undefined {
    return this.newestMessageIds.get(roomId);
  }

  // Check if we've reached the beginning of message history
  public hasReachedBeginning(roomId: string): boolean {
    return this.reachedBeginning.get(roomId) || false;
  }

  // Check if we've reached the end of message history
  public hasReachedEnd(roomId: string): boolean {
    return this.reachedEnd.get(roomId) || false;
  }

  public getLastFetchTime(roomId: string): number | undefined {
    return this.lastFetchTimes.get(roomId);
  }

  public setLastFetchTime(roomId: string): void {
    this.lastFetchTimes.set(roomId, Date.now());
  }

  public clearMessages(roomId: string): void {
    if (!this.messages.has(roomId)) return;

    console.log(`[MessageCache] Clearing all messages for room ${roomId}`);
    this.messages.get(roomId)?.clear();
    this.oldestMessageIds.delete(roomId);
    this.newestMessageIds.delete(roomId);
    this.reachedBeginning.delete(roomId);
    this.reachedEnd.delete(roomId);
    // Don't clear deleted message IDs as they should persist
  }

  // Reset the reached flags for a room
  public resetReachedFlags(roomId: string): void {
    this.reachedBeginning.set(roomId, false);
    this.reachedEnd.set(roomId, false);
  }

  // Set if we've reached the beginning of message history
  public setHasReachedBeginning(roomId: string, reached: boolean): void {
    this.reachedBeginning.set(roomId, reached);
  }

  // Set if we've reached the end of message history
  public setHasReachedEnd(roomId: string, reached: boolean): void {
    this.reachedEnd.set(roomId, reached);
  }
}
