export type PayloadType =
  | "IDENTIFY"
  | "HEARTBEAT"
  | "MESSAGE"
  | "READY"
  | "PRESENCE_UPDATE"
  | "relationshipCreate"
  | "relationshipUpdate"
  | "relationshipAccept"
  | "relationshipDelete";

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
  rooms?: { [key: string]: any };
  client_user?: any;
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

export class WebSocketClient {
  private readonly worker?: SharedWorker | null;
  private readonly messageHandlers: Map<string, (data: any) => void> =
    new Map();
  private connectPromise: Promise<boolean> | null = null;
  private readyPromise: Promise<ReadyPayload> | null = null;
  private readonly connectionStateCallbacks: ((connected: boolean) => void)[] =
    [];
  private connected = false;
  public cache: UserCache;
  private relationships: { [key: string]: any } = {};
  private relationshipRequests: { [key: string]: any } = {};
  private static workerChannel?: BroadcastChannel;
  private static activeWorker: SharedWorker | null | undefined = null;
  private static isSharedWorkerSupported = typeof SharedWorker !== "undefined";
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private baseReconnectDelay = 1000;
  private currentToken: string | null = null;

  private mapEventTypeToOpCode(eventType: string): string {
    const opCodeMap: { [key: string]: string } = {
      READY: "READY",
      HEARTBEAT_ACK: "HEARTBEAT_ACK",
      EVENT: "DISPATCH",
      RELATIONSHIP_CREATE: "RELATIONSHIP_CREATE",
      RELATIONSHIP_UPDATE: "RELATIONSHIP_UPDATE",
      RELATIONSHIP_ACCEPT: "RELATIONSHIP_ACCEPT",
      RELATIONSHIP_DELETE: "RELATIONSHIP_DELETE",
      MESSAGE: "MESSAGE",
      PRESENCE_UPDATE: "PRESENCE_UPDATE",
    };

    return opCodeMap[eventType] || "DISPATCH";
  }

  constructor(private readonly ws: WebSocket) {
    this.cache = new UserCache();

    // Set up default message handlers
    this.messageHandlers.set("READY", this.handleReady.bind(this));
    console.log("[WebSocket] READY handler set");
    this.onMessage("relationshipCreate", this.handleRelationship.bind(this));
    this.onMessage("relationshipUpdate", this.handleRelationship.bind(this));
    this.onMessage("relationshipAccept", this.handleRelationship.bind(this));
    this.onMessage("relationshipDelete", this.handleRelationship.bind(this));
    this.onMessage("PRESENCE_UPDATE", this.handlePresenceUpdate.bind(this));
    this.onMessage("message_create", this.handleMessageCreate.bind(this));
    console.log("[WebSocket] Message handlers set up:", [...this.messageHandlers.entries()]);

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

    // Try to use SharedWorker if supported
    if (WebSocketClient.isSharedWorkerSupported) {
      // Create or join the coordination channel
      if (!WebSocketClient.workerChannel) {
        WebSocketClient.workerChannel = new BroadcastChannel(
          "strafe-websocket-worker",
        );
      }

      // Try to get existing worker or create new one
      if (!WebSocketClient.activeWorker) {
        try {
          WebSocketClient.activeWorker = new SharedWorker(
            new URL("./WebSocketWorker.ts", import.meta.url),
            {
              type: "module",
              name: "StrafeChat WebSocket Worker",
            },
          );

          // Notify other tabs that we've created a worker
          WebSocketClient.workerChannel.postMessage({ type: "worker-created" });
        } catch (error) {
          console.warn(
            "Failed to create SharedWorker, falling back to direct WebSocket:",
            error,
          );
          WebSocketClient.isSharedWorkerSupported = false;
        }
      }

      if (WebSocketClient.activeWorker) {
        console.log("[WebSocket] Using SharedWorker for WebSocket connection");
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
        return; // Exit early, we're using the worker
      }
    }

    // Fallback to direct WebSocket connection if SharedWorker is not supported or failed
    console.log(
      "[WebSocket] Using direct WebSocket connection"
    );

    this.ws.onopen = () => {
      console.log("[WebSocket] Direct connection opened");
      this.connected = true;
      this.notifyConnectionState();
    };

    this.ws.onmessage = async (event) => {
      console.log("[WebSocket] Raw message received:", event.data);
      try {
        let data: any;

        if (!event.data) {
          console.warn("[WebSocket] Received empty message");
          return;
        }

        // For binary MessagePack data
        if (
          event.data instanceof ArrayBuffer ||
          event.data instanceof Uint8Array
        ) {
          const uint8Array =
            event.data instanceof ArrayBuffer
              ? new Uint8Array(event.data)
              : event.data;
          try {
            data = decode(uint8Array);
            console.log("[WebSocket] Decoded MessagePack data:", data);
          } catch (msgpackError) {
            console.error(
              "[WebSocket] Failed to decode MessagePack:",
              msgpackError,
            );
            return;
          }
        }
        // For Blob data
        else if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          try {
            data = decode(uint8Array);
            console.log("[WebSocket] Decoded Blob data:", data);
          } catch (msgpackError) {
            try {
              const textDecoder = new TextDecoder("utf-8");
              const jsonString = textDecoder.decode(uint8Array);
              data = JSON.parse(jsonString);
              console.log("[WebSocket] Decoded JSON from Blob:", data);
            } catch (jsonError) {
              console.error("[WebSocket] Failed to decode message:", {
                msgpackError,
                jsonError,
              });
              return;
            }
          }
        }
        // For string data (JSON)
        else if (typeof event.data === "string") {
          try {
            data = JSON.parse(event.data);
            console.log("[WebSocket] Parsed JSON string:", data);
          } catch (error) {
            console.error("[WebSocket] Failed to parse JSON string:", error);
            return;
          }
        }

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
    };

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

    // Listen for presence updates
    this.cache.onPresenceUpdate((userId, presence) => {
      // Dispatch presence update to any listeners
      const user = this.cache.getUser(userId);
      if (user) {
        console.log(
          "[WebSocketClient] Dispatching user update with presence:",
          { user, presence },
        );
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

  private dispatchEvent(type: string, data: any) {
    window.dispatchEvent(new CustomEvent(type, { detail: data }));
  }

  private handleWorkerMessage(event: MessageEvent) {
    console.log("[WebSocket] handleWorkerMessage invoked with data:", event.data);
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
        if (relationshipHandler) {
          relationshipHandler(payload);
        }
        break;
  
      case "ready":
        this.handleReady(payload);
        // When we get a READY event, we're definitely connected
        this.connected = true;
        this.notifyConnectionState();
        break;
  
      case "connectionState":
        console.log("[WebSocket] Connection state update from worker:", payload);
        const wasConnected = this.connected;
        this.connected = payload.connected;
        
        // Only notify if the state actually changed
        if (wasConnected !== this.connected) {
          console.log(`[WebSocket] Connection state changed: ${wasConnected} -> ${this.connected}`);
          this.notifyConnectionState();
        }
        
        if (this.connectPromise) {
          this.connectPromise = Promise.resolve(payload.connected);
        }
        break;
      
      case "connected":
        console.log("[WebSocket] Connected state update from worker:", payload);
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

  // private async handleMessage(event: MessageEvent) {
  //   try {
  //     let data: any;
  
  //     if (!event.data) {
  //       console.warn("[WebSocket] Received empty message");
  //       return;
  //     }
  
  //     // For binary MessagePack data
  //     if (
  //       event.data instanceof ArrayBuffer ||
  //       event.data instanceof Uint8Array
  //     ) {
  //       try {
  //         const uint8Array =
  //           event.data instanceof ArrayBuffer
  //             ? new Uint8Array(event.data)
  //             : event.data;
  //         data = decode(uint8Array);
  //         console.log("[WebSocket] Decoded MessagePack data:", data);
  //       } catch (error) {
  //         console.error("[WebSocket] Failed to decode MessagePack:", error);
  //         return;
  //       }
  //     }
  //     // For Blob data
  //     else if (event.data instanceof Blob) {
  //       const arrayBuffer = await event.data.arrayBuffer();
  //       const uint8Array = new Uint8Array(arrayBuffer);
  //       try {
  //         data = decode(uint8Array);
  //         console.log("[WebSocket] Decoded Blob data:", data);
  //       } catch (msgpackError) {
  //         try {
  //           const textDecoder = new TextDecoder("utf-8");
  //           const jsonString = textDecoder.decode(uint8Array);
  //           data = JSON.parse(jsonString);
  //         } catch (jsonError) {
  //           console.error("[WebSocket] Failed to decode message:", {
  //             msgpackError,
  //             jsonError,
  //           });
  //           return;
  //         }
  //       }
  //     }
  //     // For string data (JSON)
  //     else if (typeof event.data === "string") {
  //       try {
  //         data = JSON.parse(event.data);
  //         console.log("[WebSocket] Parsed JSON data:", data);
  //       } catch (error) {
  //         console.error("[WebSocket] Failed to parse JSON string:", error);
  //         return;
  //       }
  //     }
  
  //     // Normalize and validate payload
  //     data = this.normalizePayload(data);
  //     if (!(data.op !== undefined && data.d !== undefined)) {
  //       data = { op: 0, d: data };
  //     }
  
  //     // Handle READY event specially
  //     if (data.op === "READY" || (data.op === 0 && data.t === "READY")) {
  //       this.handleReady({ type: "READY", ...data.d });
  //       return;
  //     }
  
  //     // Handle other events
  //     if (data.op) {
  //       const type = this.mapEventTypeToOpCode(data.op);
  //       const handler = this.messageHandlers.get(type);
  //       if (handler) {
  //         handler(data.d);
  //       }
  //     }
  //   } catch (error) {
  //     console.error("[WebSocket] Error handling message:", error);
  //   }
  // }

  private handleMessageCreate(data: any) {
    console.log("[WebSocket] Handling message create:", data);
    if (data.room_id) {
      console.log("[WebSocket] Dispatching message create event:", data)
      // Dispatch a messageCreate event for the CacheProvider to handle
      // instead of trying to use UserCache.addMessage which doesn't exist
      this.dispatchEvent("messageCreate", {
        roomId: data.room_id,
        message: {
          id: data.id || "",
          content: data.content || "",
          author_id: data.author_id || data.sender_id || "",
          room_id: data.room_id,
          created_at: data.created_at || new Date().toISOString(),
          edited_at: data.edited_at || null,
          attachments: data.attachments || [],
          author: data.author || null
        }
      });
    }
  }

  private async requestUserData(userIds: string[]) {
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

  private handleReady(data: ReadyPayload) {
    console.log(
      "[WebSocket] Received READY payload:",
      JSON.stringify(data, null, 2),
    );
    console.log("[WebSocket] Current messageHandlers:", [
      ...this.messageHandlers.entries(),
    ]);

    // Set connected state
    this.connected = true;
    this.notifyConnectionState();

    // Pass the full READY payload to any registered READY handlers
    const readyHandler = this.messageHandlers.get("READY");
    if (readyHandler) {
      console.log("[WebSocket] Calling READY handler with data");
      readyHandler(data);
    } else {
      console.warn("[WebSocket] No READY handler found!");
    }

    // Cache users if available
    if (data.users && this.cache) {
      console.log("[WebSocket] Caching users:", Object.keys(data.users).length);
      this.cache.setUsers(data.users);
    } else {
      console.warn(
        "[WebSocket] No users data in READY payload or cache not initialized",
      );
    }

    // Cache users from group PMs
    if (data.rooms) {
      const groupPMUsers = new Set<string>();
      data.rooms.forEach((room: { type: number; recipients?: string[] }) => {
        if (room.type === 1 && room.recipients) { // type 1 is GROUP_PM
          room.recipients.forEach(userId => groupPMUsers.add(userId));
        }
      });

      // Request user data for uncached group PM members in batches of 100
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
    } else {
      console.warn("[WebSocket] No client_user data in READY payload");
    }
  }

  private handleRelationship(payload: RelationshipPayload) {
    console.log("[WebSocketClient] Handling relationship event:", payload);

    if (!payload.relationship) {
      console.error("[WebSocketClient] Invalid relationship payload:", payload);
      return;
    }

    const relationshipId = payload.relationship.id;
    console.log(
      `[WebSocketClient] Processing relationship ${relationshipId} for event type ${payload.type}`,
    );

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

  private handlePresenceUpdate(payload: PresenceUpdatePayload) {
    console.log("[WebSocketClient] Handling presence update:", payload);
    if (!this.cache) {
      console.warn("[WebSocketClient] No cache available for presence update");
      return;
    }
    console.log(
      "[WebSocketClient] Cache exists, current users:",
      Array.from(this.cache.getUsers().keys()),
    );
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

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // More aggressive initial reconnect attempts
    let delay;
    if (this.reconnectAttempts < 3) {
      // First 3 attempts: 1s, 2s, 4s
      delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
        4000,
      );
    } else {
      // After 3 attempts, use exponential backoff up to 30s
      delay = Math.min(
        this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
        30000,
      );
    }

    console.log(
      `[WebSocket] Scheduling reconnect attempt ${
        this.reconnectAttempts + 1
      } in ${delay}ms`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.currentToken) {
        console.log(
          `[WebSocket] Attempting reconnect ${this.reconnectAttempts}`,
        );
        // Reset reconnect attempts if we've been disconnected for a while
        if (this.reconnectAttempts > 5) {
          console.log("[WebSocket] Resetting reconnect attempts");
          this.reconnectAttempts = 0;
        }
        this.connect(this.currentToken);
      }
    }, delay) as unknown as number;
  }

  private startHeartbeat() {
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

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // private async requestUserData(userIds: string[]) {
  //   if (!userIds.length) return;
    
  //   console.log("[WebSocketClient] Requesting user data for:", userIds);
    
  //   try {
  //     const response = await fetch(`${BASE_URL}/users/bulk`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "X-Session-Token": localStorage.getItem("sc_token") || "",
  //       },
  //       body: JSON.stringify({ user_ids: userIds }),
  //     });

  //     if (!response.ok) {
  //       throw new Error(`Failed to fetch user data: ${response.status}`);
  //     }

  //     const userData = await response.json();
  //     console.log("[WebSocketClient] Received user data:", userData);
      
  //     // Add users to cache
  //     if (userData && userData.users) {
  //       this.cache.setUsers(userData.users);
  //     }
  //   } catch (error) {
  //     console.error("[WebSocketClient] Error fetching user data:", error);
  //   }
  // }

  public async connect(token: string): Promise<boolean> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.currentToken = token;
    this.connectPromise = new Promise((resolve) => {
      // Set a timeout to resolve with current connection state if no update received
      const timeout = setTimeout(() => {
        console.log("[WebSocket] Connection timeout, resolving with current state:", this.connected);
        resolve(this.connected);
      }, 5000);

      // Create a one-time connection state callback
      const onConnectionChange = (connected: boolean) => {
        if (connected) {
          console.log("[WebSocket] Connection established, resolving promise");
          clearTimeout(timeout);
          // Remove this callback after it's triggered
          const index = this.connectionStateCallbacks.indexOf(onConnectionChange);
          if (index !== -1) {
            this.connectionStateCallbacks.splice(index, 1);
          }
          resolve(true);
        }
      };

      // Add the callback to our list
      this.connectionStateCallbacks.push(onConnectionChange);

      if (WebSocketClient.isSharedWorkerSupported && this.worker) {
        console.log("[WebSocket] Sending connect message to worker with token");
        this.worker.port.postMessage({
          type: "connect",
          payload: { token },
        });
      } else {
        // Direct WebSocket connection
        this.ws.onopen = () => {
          console.log("[WebSocket] Direct connection opened, sending identify");
          const identifyPayload: IdentifyPayload = {
            type: "IDENTIFY",
            token,
            device: "browser",
          };

          this.ws.send(JSON.stringify(identifyPayload));
          this.connected = true;
          this.notifyConnectionState();
          this.startHeartbeat();
          this.reconnectAttempts = 0;
          resolve(true);
        };
      }
    });

    return this.connectPromise;
  }

  public send(payload: WSPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
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

  public onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public disconnect() {
    if (WebSocketClient.isSharedWorkerSupported && this.worker) {
      this.worker.port.postMessage({ type: "disconnect" });
    } else {
      this.ws.close();
    }
    this.connected = false;
    this.notifyConnectionState();
  }

  public async getUserDetails(): Promise<ReadyPayload> {
    if (!this.readyPromise) {
      throw new Error("Not connected or authentication not complete");
    }
    return this.readyPromise;
  }

  public onConnectionStateChange(callback: (connected: boolean) => void) {
    this.connectionStateCallbacks.push(callback);
    // Immediately notify of current state if connected
    if (this.connected) {
      callback(true);
    }
  }

  private notifyConnectionState() {
    for (const callback of this.connectionStateCallbacks) {
      callback(this.connected);
    }
  }
}

  