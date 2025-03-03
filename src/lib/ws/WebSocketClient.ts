export type PayloadType =
  | "IDENTIFY"
  | "HEARTBEAT"
  | "MESSAGE"
  | "READY"
  | "PRESENCE_UPDATE"
  | "relationshipCreate"
  | "relationshipUpdate"
  | "relationshipAccept"
  | "relationshipDelete"
  | "ROOM_CREATE"
  | "MESSAGE_CREATE";

export interface BasePayload {
  type: PayloadType;
}

export interface IdentifyPayload extends BasePayload {
  type: "IDENTIFY";
  token: string;
  device?: string;
}

export interface HeartbeatPayload extends BasePayload {
  type: "HEARTBEAT";
  timestamp: bigint;
}

export interface MessagePayload extends BasePayload {
  type: "MESSAGE";
  channel_id: string;
  content: string;
}

export interface ReadyPayload extends BasePayload {
  type: "READY";
  user_id: string;
  username: string;
  discriminator: string;
  display_name?: string;
  presence?: any;
  users?: { [key: string]: any };
  rooms?: any[];
  client_user?: any;
  relationship_requests?: any[];
  relationships?: string[];
}

export interface RelationshipPayload extends BasePayload {
  type:
    | "relationshipCreate"
    | "relationshipUpdate"
    | "relationshipAccept"
    | "relationshipDelete";
  relationship: {
    id: string;
    sender_id: string;
    recipient_id: string;
    created_at: string;
    sender?: {
      banner?: string;
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
      display_name?: string;
      presence: {
        status: string;
        custom_status: string;
      };
    };
    recipient?: {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
      banner?: string;
      display_name?: string;
      presence: {
        status: string;
        custom_status: string;
      };
    };
  };
}

export interface PresenceUpdatePayload extends BasePayload {
  type: "PRESENCE_UPDATE";
  user_id: string;
  status: string;
  custom_status: string;
}

export type WSPayload =
  | IdentifyPayload
  | HeartbeatPayload
  | MessagePayload
  | ReadyPayload
  | RelationshipPayload
  | PresenceUpdatePayload;

import { UserCache } from "../cache/UserCache";
import { handlePresenceUpdate } from "../events/presence/update";
import { decode, encode } from "@msgpack/msgpack";
import { BASE_URL } from "../../constants";

// Map of event types to their corresponding op codes
const EVENT_TYPE_TO_OP_CODE: Record<string, string> = {
  READY: "READY",
  HEARTBEAT_ACK: "HEARTBEAT_ACK",
  EVENT: "DISPATCH",
  RELATIONSHIP_CREATE: "RELATIONSHIP_CREATE",
  RELATIONSHIP_UPDATE: "RELATIONSHIP_UPDATE",
  RELATIONSHIP_ACCEPT: "RELATIONSHIP_ACCEPT",
  RELATIONSHIP_DELETE: "RELATIONSHIP_DELETE",
  MESSAGE: "MESSAGE",
  PRESENCE_UPDATE: "PRESENCE_UPDATE",
  ROOM_CREATE: "ROOM_CREATE",
  MESSAGE_CREATE: "MESSAGE_CREATE"
};

export class WebSocketClient {
  private worker?: SharedWorker | null;
  private readonly messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectPromise: Promise<boolean> | null = null;
  private readyPromise: Promise<ReadyPayload> | null = null;
  private connectionStateCallbacks: ((connected: boolean) => void)[] = [];
  private connected = false;
  public cache: UserCache;
  private relationships: Record<string, any> = {};
  private relationshipRequests: Record<string, any> = {};
  private static workerChannel?: BroadcastChannel;
  private static activeWorker: SharedWorker | null | undefined = null;
  private static isSharedWorkerSupported = typeof SharedWorker !== "undefined";
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private baseReconnectDelay = 1000;
  private currentToken: string | null = null;

  constructor(private readonly ws: WebSocket) {
    this.cache = new UserCache();
    this.setupMessageHandlers();
    this.setupReadyPromise();
    this.setupWorkerOrDirectConnection();
    this.setupPresenceUpdateListener();
  }

  private setupMessageHandlers(): void {
    // Set up default message handlers
    this.messageHandlers.set("READY", this.handleReady.bind(this));
    this.onMessage("relationshipCreate", this.handleRelationship.bind(this));
    this.onMessage("relationshipUpdate", this.handleRelationship.bind(this));
    this.onMessage("relationshipAccept", this.handleRelationship.bind(this));
    this.onMessage("relationshipDelete", this.handleRelationship.bind(this));
    this.onMessage("PRESENCE_UPDATE", this.handlePresenceUpdate.bind(this));
    this.onMessage("MESSAGE_CREATE", this.handleMessageCreate.bind(this));
    this.onMessage("ROOM_CREATE", this.handleRoomCreate.bind(this));
    console.log("[WebSocket] Message handlers set up:", [...this.messageHandlers.entries()]);
  }

  private setupReadyPromise(): void {
    // Initialize readyPromise
    this.readyPromise = new Promise((resolve) => {
      const readyHandler = this.messageHandlers.get("READY");
      if (readyHandler) {
        this.messageHandlers.set("READY", (data) => {
          readyHandler(data);
          resolve(data);
        });
      }
    });
  }

  private setupWorkerOrDirectConnection(): void {
    if (WebSocketClient.isSharedWorkerSupported) {
      this.setupSharedWorker();
    } else {
      this.setupDirectConnection();
    }
  }

  private setupSharedWorker(): void {
    // Create or join the coordination channel
    if (!WebSocketClient.workerChannel) {
      WebSocketClient.workerChannel = new BroadcastChannel("strafe-websocket-worker");
    }

    // Try to get existing worker or create new one
    if (!WebSocketClient.activeWorker) {
      try {
        WebSocketClient.activeWorker = new SharedWorker(
          new URL("./WebSocketWorker.ts", import.meta.url),
          {
            type: "module",
            name: "StrafeChat WebSocket Worker",
          }
        );

        // Notify other tabs that we've created a worker
        WebSocketClient.workerChannel.postMessage({ type: "worker-created" });
      } catch (error) {
        console.warn(
          "Failed to create SharedWorker, falling back to direct WebSocket:",
          error
        );
        WebSocketClient.isSharedWorkerSupported = false;
        this.setupDirectConnection();
        return;
      }
    }

    if (WebSocketClient.activeWorker) {
      this.worker = WebSocketClient.activeWorker;
      this.worker.port.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.port.start();

      // Listen for worker creation from other tabs
      WebSocketClient.workerChannel.onmessage = (event) => {
        if (event.data.type === "worker-created") {
          WebSocketClient.activeWorker = this.worker;
        }
      };

      this.worker.port.postMessage({
        type: "init",
        payload: { url: this.ws.url },
      });
    }
  }

  private setupDirectConnection(): void {
    console.log("[WebSocket] Using direct WebSocket connection (SharedWorker not supported)");

    this.ws.onopen = () => {
      console.log("[WebSocket] Direct connection opened");
    };

    this.ws.onmessage = this.handleDirectMessage.bind(this);

    this.ws.onclose = (event) => {
      console.log("[WebSocket] Direct connection closed:", event);
      this.connected = false;
      this.notifyConnectionState();
      if (this.currentToken) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Direct connection error:", error);
      this.connected = false;
      this.notifyConnectionState();
    };
  }

  private setupPresenceUpdateListener(): void {
    // Listen for presence updates
    this.cache.onPresenceUpdate((userId, presence) => {
      // Dispatch presence update to any listeners
      const user = this.cache.getUser(userId);
      if (user) {
        this.dispatchEvent("userUpdate", {
          id: user.ID,
          username: user.Username,
          discriminator: user.Discriminator,
          display_name: user.DisplayName,
          avatar: user.Avatar,
          banner: user.Banner,
          presence: {
            status: presence.status,
            custom_status: presence.custom_status,
          },
        });
      }
    });
  }

  private async handleDirectMessage(event: MessageEvent): Promise<void> {
    console.log("[WebSocket] Raw message received:", event.data);
    try {
      let data: any;

      if (!event.data) {
        console.warn("[WebSocket] Received empty message");
        return;
      }

      data = await this.decodeMessage(event.data);
      if (!data) return;

      // Normalize the payload to use lowercase keys
      data = this.normalizePayload(data);

      // Ensure the data follows the standard event payload structure
      if (!(data.op !== undefined && data.d !== undefined)) {
        console.warn("[WebSocket] Received non-standard payload:", data);
        data = {
          op: 0,
          d: data,
        };
      }

      // Handle READY event specially
      if (data.op === "READY" || (data.op === 0 && data.t === "READY")) {
        const readyData = {
          type: "READY",
          ...(data.d || data),
        };
        console.log("[WebSocket] Processing READY event:", readyData);
        this.handleReady(readyData);
        return;
      }

      // For other events, use the existing handler
      if (data.op) {
        const type = this.mapEventTypeToOpCode(data.op);
        const handler = this.messageHandlers.get(type);
        if (handler) {
          handler(data.d);
        } else {
          console.warn("[WebSocket] No handler for message type:", type);
        }
      }
    } catch (error) {
      console.error("[WebSocket] Error handling message:", error);
    }
  }

  private async decodeMessage(data: any): Promise<any> {
    // For binary MessagePack data
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      try {
        const decoded = decode(uint8Array);
        console.log("[WebSocket] Decoded MessagePack data:", decoded);
        return decoded;
      } catch (msgpackError) {
        console.error("[WebSocket] Failed to decode MessagePack:", msgpackError);
        return null;
      }
    }
    // For Blob data
    else if (data instanceof Blob) {
      const arrayBuffer = await data.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      try {
        const decoded = decode(uint8Array);
        console.log("[WebSocket] Decoded Blob data:", decoded);
        return decoded;
      } catch (msgpackError) {
        try {
          const textDecoder = new TextDecoder("utf-8");
          const jsonString = textDecoder.decode(uint8Array);
          const parsed = JSON.parse(jsonString);
          console.log("[WebSocket] Decoded JSON from Blob:", parsed);
          return parsed;
        } catch (jsonError) {
          console.error("[WebSocket] Failed to decode message:", {
            msgpackError,
            jsonError,
          });
          return null;
        }
      }
    }
    // For string data (JSON)
    else if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        console.log("[WebSocket] Parsed JSON string:", parsed);
        return parsed;
      } catch (error) {
        console.error("[WebSocket] Failed to parse JSON string:", error);
        return null;
      }
    }
    return data;
  }

  private dispatchEvent(type: string, data: any): void {
    window.dispatchEvent(new CustomEvent(type, { detail: data }));
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case "message":
      case "dispatch":
      case "message_create":
        const handler = this.messageHandlers.get(payload.type);
        if (handler) {
          handler(payload);
        } else {
          console.warn("[WebSocket] No handler for message type:", payload.type);
        }
        break;

      case "relationshipCreate":
      case "relationshipUpdate":
      case "relationshipAccept":
      case "relationshipDelete":
        const relationshipHandler = this.messageHandlers.get(type);
        if (relationshipHandler)
          relationshipHandler(payload);
        break;
      
      case "roomCreate":
        this.handleRoomCreate(payload);
        break;

      case "ready":
        this.handleReady(payload);
        break;

      case "connectionState":
        console.log("[WebSocket] Connection state update received:", payload);
        this.connected = payload.connected;
        this.notifyConnectionState();
        // This is the key fix - explicitly call the connection state callbacks
        // to ensure the connection timeout is cleared
        if (this.connectionStateCallbacks.length > 0) {
          console.log("[WebSocket] Notifying connection state callbacks directly");
          // Make a copy of the callbacks to avoid modification during iteration
          [...this.connectionStateCallbacks].forEach(callback => callback(payload.connected));
        }
        break;
        
      case "connected":
        console.log("[WebSocket] Connected state update received:", payload);
        this.connected = payload.connected;
        this.notifyConnectionState();
        if (this.connectPromise) {
          this.connectPromise = Promise.resolve(payload.connected);
        }
        break;

      case "error":
        console.error("[WebSocket] Error from worker:", payload.error);
        break;
    }
  }

  private async handleRoomCreate(payload: any): Promise<void> {
    if (!payload || !payload.data) {
      console.error("[WebSocketClient] Invalid room create payload:", payload);
      return;
    }

    const room = payload.data;
    const currentUserId = this.cache.getCurrentUserId();

    // Check for uncached recipients
    if (room.recipients && Array.isArray(room.recipients)) {
      const missingUserIds = room.recipients.filter(
        (id: string) => id !== currentUserId && !this.cache.getUser(id)
      );

      if (missingUserIds.length > 0) {
        try {
          // Fetch users in batches of 100
          for (let i = 0; i < missingUserIds.length; i += 100) {
            const batch = missingUserIds.slice(i, i + 100);
            const response = await fetch(`${BASE_URL}/users/bulk`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': this.currentToken || localStorage.getItem('sc_token') || ''
              },
              body: JSON.stringify({ ids: batch })
            });

            if (response.ok) {
              const users = await response.json() as BulkUserResponse;
              // Add fetched users to cache
              if (users && users.users) {
                Object.entries(users.users).forEach(([userId, user]) => {
                  this.cache.setUser({
                    id: userId,
                    username: user.Username,
                    discriminator: user.Discriminator,
                    display_name: user.DisplayName || user.Username,
                    avatar: user.Avatar,
                    banner: user.Banner,
                    presence: {
                      status: user.Presence?.Status || 'offline',
                      custom_status: user.Presence?.CustomStatus || ''
                    }
                  });
                });
              }
            }
          }

          // Update recipients_data with cached user information
          room.recipients_data = room.recipients.map((recipientId: string) => {
            const userData = this.cache.getUser(recipientId);
            return userData ? {
              id: recipientId,
              username: userData.Username,
              discriminator: userData.Discriminator,
              display_name: userData.DisplayName || userData.Username,
              avatar: userData.Avatar,
              presence: userData.Presence
            } : null;
          }).filter(Boolean);

        } catch (error) {
          console.error("[WebSocketClient] Error fetching users:", error);
        }
      }
    }

    // Dispatch the room create event with updated recipients_data
    this.dispatchEvent('ROOM_CREATE', room);
  }

  private handleMessageCreate(data: any): void {
    console.log("[WebSocket] Handling message create:", data);
    const messageData = data.data || data;
    if (messageData.room_id) {
      console.log("[WebSocket] Dispatching message create event:", messageData);
      this.dispatchEvent("messageCreate", {
        roomId: messageData.room_id,
        message: {
          id: messageData.id || "",
          content: messageData.content || "",
          author_id: messageData.author_id || messageData.sender_id || "",
          room_id: messageData.room_id,
          created_at: messageData.created_at || new Date().toISOString(),
          edited_at: messageData.edited_at || null,
          attachments: messageData.attachments || [],
          author: messageData.author || null
        }
      });
    }
  }

  private async requestUserData(userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    
    try {
      const response = await fetch(`${BASE_URL}/users/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': this.currentToken || localStorage.getItem('sc_token') || '',
        },
        body: JSON.stringify({ ids: userIds }),
      });

      if (!response.ok) {
        console.error('[WebSocket] Failed to fetch user data:', response.status);
        return;
      }

      const userData = await response.json();
      if (userData && userData.users) {
        this.cache.setUsers(userData.users);
      }
    } catch (error) {
      console.error('[WebSocket] Error fetching user data:', error);
    }
  }

  private handleReady(data: ReadyPayload): void {
    console.log("[WebSocket] Received READY payload:", data);
    
    // Set connected state
    this.connected = true;
    this.notifyConnectionState();

    // Cache users if available
    if (data.users && this.cache) {
      console.log("[WebSocket] Caching users:", Object.keys(data.users).length);
      this.cache.setUsers(data.users);
    }

    // Cache users from group PMs
    if (data.rooms) {
      const groupPMUsers = new Set<string>();
      data.rooms.forEach((room: { type: number; recipients?: string[] }) => {
        if (room.type === 1 && room.recipients) { // type 1 is GROUP_PM
          room.recipients.forEach(userId => groupPMUsers.add(userId));
        }
      });

      // Request user data for uncached group PM members
      if (groupPMUsers.size > 0) {
        const uncachedUsers = Array.from(groupPMUsers).filter(userId => !this.cache.getUser(userId));
        if (uncachedUsers.length > 0) {
          // Split into batches of 100 users
          for (let i = 0; i < uncachedUsers.length; i += 100) {
            const batch = uncachedUsers.slice(i, i + 100);
            this.requestUserData(batch);
          }
        }
      }
    }

    if (data.client_user) {
      console.log("[WebSocket] Client user data received:", data.client_user);
      // Add client user to cache
      if (this.cache) {
        this.cache.setUser({
          id: data.client_user.id || data.client_user.ID,
          username: data.client_user.username || data.client_user.Username,
          discriminator: data.client_user.discriminator || data.client_user.Discriminator,
          display_name: data.client_user.display_name || data.client_user.DisplayName || data.client_user.username || data.client_user.Username,
          avatar: data.client_user.avatar || data.client_user.Avatar,
          banner: data.client_user.banner || data.client_user.Banner,
          presence: {
            status: data.client_user.presence?.status || data.client_user.Presence?.Status || "online",
            custom_status: data.client_user.presence?.custom_status || data.client_user.Presence?.CustomStatus || ""
          }
        });
      }
    }
    
    // Pass the full READY payload to any registered READY handlers
    const readyHandler = this.messageHandlers.get("READY");
    if (readyHandler) {
      readyHandler(data);
    }
  }

  private handleRelationship(payload: RelationshipPayload): void {
    console.log("[WebSocketClient] Handling relationship event:", payload);

    if (!payload.relationship) {
      console.error("[WebSocketClient] Invalid relationship payload:", payload);
      return;
    }

    const relationshipId = payload.relationship.id;
    
    // Cache user data
    if (payload.relationship.sender) {
      this.cache.setUsers({
        [payload.relationship.sender.id]: payload.relationship.sender,
      });
    }
    if (payload.relationship.recipient) {
      this.cache.setUsers({
        [payload.relationship.recipient.id]: payload.relationship.recipient,
      });
    }

    // Emit event for UI updates
    this.dispatchEvent(payload.type, {
      id: relationshipId,
      type: payload.type,
      sender: payload.relationship.sender,
      recipient: payload.relationship.recipient,
      created_at: payload.relationship.created_at,
    });

    // Update internal state
    switch (payload.type) {
      case "relationshipCreate":
        this.relationshipRequests[relationshipId] = payload.relationship;
        break;
      case "relationshipAccept":
        // Move from requests to relationships
        delete this.relationshipRequests[relationshipId];
        this.relationships[relationshipId] = payload.relationship;
        break;
      case "relationshipDelete":
        // Clean up from both collections
        delete this.relationshipRequests[relationshipId];
        delete this.relationships[relationshipId];
        break;
    }
  }

  private handlePresenceUpdate(payload: PresenceUpdatePayload): void {
    console.log("[WebSocketClient] Handling presence update:", payload);
    if (!this.cache) {
      console.warn("[WebSocketClient] No cache available for presence update");
      return;
    }
    handlePresenceUpdate(payload, this.cache);
  }

  private normalizePayload(data: any): any {
    // Normalize payload to use lowercase keys
    if (data && typeof data === "object") {
      const normalizedData: any = {};

      // Copy existing lowercase keys
      if ("op" in data) normalizedData.op = data.op;
      if ("d" in data) normalizedData.d = data.d;
      if ("t" in data) normalizedData.t = data.t;
      
      // Map uppercase keys to lowercase
      if ("Op" in data) normalizedData.op = data.Op;
      if ("D" in data) normalizedData.d = data.D;
      if ("T" in data) normalizedData.t = data.T;

      // Handle 't' field
      if ("t" in normalizedData) {
        normalizedData.op = this.mapEventTypeToOpCode(normalizedData.t);
        delete normalizedData.t;
      }

      // If no normalized keys found, use original data
      return Object.keys(normalizedData).length > 0 ? normalizedData : data;
    }
    return data;
  }

  private mapEventTypeToOpCode(eventType: string): string {
    return EVENT_TYPE_TO_OP_CODE[eventType] || "DISPATCH";
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // More aggressive initial reconnect attempts
    let delay;
    if (this.reconnectAttempts < 3) {
      // First 3 attempts: 1s, 2s, 4s
      delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
        4000
      );
    } else {
      // After 3 attempts, use exponential backoff up to 30s
      delay = Math.min(
        this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
        30000
      );
    }

    console.log(
      `[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.currentToken) {
        console.log(`[WebSocket] Attempting reconnect ${this.reconnectAttempts}`);
        // Reset reconnect attempts if we've been disconnected for a while
        if (this.reconnectAttempts > 5) {
          console.log("[WebSocket] Resetting reconnect attempts");
          this.reconnectAttempts = 0;
        }
        this.connect(this.currentToken);
      }
    }, delay) as unknown as number;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send initial heartbeat immediately
    if (this.isConnected()) {
      console.log("[WebSocket] Sending initial heartbeat");
      const payload: HeartbeatPayload = {
        type: "HEARTBEAT",
        timestamp: BigInt(Date.now()),
      };
      this.send(payload);
    }

    // Set up heartbeat interval (every 15 seconds)
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        console.log("[WebSocket] Sending heartbeat");
        const payload: HeartbeatPayload = {
          type: "HEARTBEAT",
          timestamp: BigInt(Date.now()),
        };

        this.send(payload).catch((error) => {
          console.error("[WebSocket] Heartbeat failed:", error);
          if (this.currentToken) {
            this.ws?.close(1000, "Heartbeat failed");
          }
        });
      }
    }, 15000) as unknown as number;
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public async connect(token: string): Promise<boolean> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.currentToken = token;
    this.connectPromise = new Promise((resolve) => {
      if (WebSocketClient.isSharedWorkerSupported && this.worker) {
        console.log("[WebSocket] Sending connect message to worker with token");
        
        // Set up a timeout to detect connection failures
        const connectionTimeout = setTimeout(() => {
          console.warn("[WebSocket] Connection timeout - no response from worker");
          this.connected = false;
          this.notifyConnectionState();
          resolve(false);
        }, 10000); // 10 second timeout

        // Set up a one-time connection state handler
        const connectionHandler = (connected: boolean) => {
          clearTimeout(connectionTimeout);
          this.connectionStateCallbacks = this.connectionStateCallbacks.filter(cb => cb !== connectionHandler);
          resolve(connected);
        };
        this.connectionStateCallbacks.push(connectionHandler);
        
        // Send connect message to worker
        try {
          this.worker.port.postMessage({
            type: "connect",
            payload: { token },
          });
        } catch (error) {
          console.error("[WebSocket] Error sending connect message to worker:", error);
          clearTimeout(connectionTimeout);
          this.connected = false;
          this.notifyConnectionState();
          resolve(false);
        }
      } else {
        // Direct WebSocket connection
        // Set up a timeout for direct connection
        const connectionTimeout = setTimeout(() => {
          console.warn("[WebSocket] Direct connection timeout");
          this.connected = false;
          this.notifyConnectionState();
          resolve(false);
        }, 10000); // 10 second timeout
        
        this.ws.onopen = () => {
          console.log("[WebSocket] Direct connection opened, sending identify");
          const identifyPayload: IdentifyPayload = {
            type: "IDENTIFY",
            token,
            device: "browser",
          };

          try {
            this.ws.send(JSON.stringify(identifyPayload));
            clearTimeout(connectionTimeout);
            this.connected = true;
            this.notifyConnectionState();
            this.startHeartbeat();
            this.reconnectAttempts = 0;
            resolve(true);
          } catch (error) {
            console.error("[WebSocket] Failed to send identify:", error);
            clearTimeout(connectionTimeout);
            this.connected = false;
            this.notifyConnectionState();
            resolve(false);
          }
        };
      }
    });

    return this.connectPromise;
  }

  public send(payload: WSPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      try {
        // Convert BigInt to number for MessagePack compatibility
        const processedPayload = Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [
            key,
            typeof value === "bigint" ? Number(value) : value,

          ]),
        );

        // Encode with MessagePack
        const encodedPayload = encode(processedPayload);
        this.ws.send(encodedPayload);
        resolve();
      } catch (error) {
        console.error("[WebSocket] Error sending payload:", error);
        reject(error);
      }
    });
  }

  public onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public disconnect(): void {
    if (WebSocketClient.isSharedWorkerSupported && this.worker) {
      this.worker.port.postMessage({ type: "disconnect" });
    } else {
      this.ws.close();
    }
    this.connected = false;
    this.notifyConnectionState();
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  public async getUserDetails(): Promise<ReadyPayload> {
    if (!this.readyPromise) {
      throw new Error("Not connected or authentication not complete");
    }
    return this.readyPromise;
  }

  public onConnectionStateChange(callback: (connected: boolean) => void): void {
    this.connectionStateCallbacks.push(callback);
    // Immediately notify of current state if connected
    if (this.connected) {
      callback(true);
    }
  }

  private notifyConnectionState(): void {
    for (const callback of this.connectionStateCallbacks) {
      callback(this.connected);
    }
  }
}

interface BulkUserResponse {
  users: {
    [key: string]: {
      ID: string;
      Username: string;
      Discriminator: number;
      DisplayName?: string;
      Avatar?: string;
      Banner?: string;
      Presence?: {
        Status?: string;
        CustomStatus?: string;
      };
    };
  };
}

  