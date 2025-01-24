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
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
      display_name?: string;
    };
    recipient?: {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
      display_name?: string;
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

export class WebSocketClient {
  private readonly worker?: SharedWorker | null;
  private readonly messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectPromise: Promise<boolean> | null = null;
  private readyPromise: Promise<ReadyPayload> | null = null;
  private readonly connectionStateCallbacks: ((connected: boolean) => void)[] = [];
  private connected = false;
  public cache: UserCache;
  private relationships: { [key: string]: any } = {};
  private relationshipRequests: { [key: string]: any } = {};
  private static workerChannel?: BroadcastChannel;
  private static activeWorker: SharedWorker | null | undefined = null;
  private static isSharedWorkerSupported = typeof SharedWorker !== 'undefined';

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

    if (WebSocketClient.isSharedWorkerSupported) {
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
          console.warn("Failed to create SharedWorker, falling back to direct WebSocket:", error);
          WebSocketClient.isSharedWorkerSupported = false;
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

    if (!WebSocketClient.isSharedWorkerSupported) {
      console.log("[WebSocket] Using direct WebSocket connection (SharedWorker not supported)");
      // Direct WebSocket handling when SharedWorker is not supported
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[WebSocket] Received direct message:", data);
          // For READY events in direct mode, we need to normalize the payload
          if (data.type === "READY") {
            console.log("[WebSocket] Received READY event in direct mode:", data);
            const normalizedData = {
              type: "READY",
              ...data
            };
            this.handleMessage(normalizedData);
          } else {
            this.handleMessage(data);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("[WebSocket] Direct connection closed");
        this.connected = false;
        this.notifyConnectionState();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.connected = false;
        this.notifyConnectionState();
      };
    }

    // Listen for presence updates
    this.cache.onPresenceUpdate((userId, presence) => {
      // Dispatch presence update to any listeners
      const user = this.cache.getUser(userId);
      if (user) {
        console.log(
          "[WebSocketClient] Dispatching user update with presence:",
          { user, presence }
        );
        this.dispatchEvent("userUpdate", {
          id: user.ID,
          username: user.Username,
          discriminator: user.Discriminator,
          display_name: user.DisplayName,
          avatar: user.Avatar,
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
    console.log("[WebSocket] handleWorkerMessage invoked with data:", JSON.stringify(event.data, null, 2));
    const { type, payload } = event.data;
    console.log("[WebSocket] Message type received:", type);
    console.log("[WebSocket] Payload:", JSON.stringify(payload, null, 2));

    switch (type) {
      case "message":
      case "dispatch":
        console.log("[WebSocket] Processing message type:", payload.type);
        const handler = this.messageHandlers.get(payload.type);
        if (handler) {
          console.log("[WebSocket] Calling handler for type:", payload.type);
          handler(payload);
        } else {
          console.warn("[WebSocket] No handler found for type:", payload.type, "Available handlers:", [...this.messageHandlers.keys()]);
        }
        break;
      case "relationshipCreate":
      case "relationshipUpdate":
      case "relationshipAccept":
      case "relationshipDelete":
        console.log(
          "[WebSocket] Processing relationship event:",
          type,
          payload
        );
        const relationshipHandler = this.messageHandlers.get(type);
        if (relationshipHandler) {
          console.log(
            "[WebSocket] Calling relationship handler for type:",
            type
          );
          relationshipHandler(payload);
        } else {
          console.warn(
            "[WebSocket] No handler found for relationship event:",
            type
          );
        }
        break;
      case "ready":
        this.handleReady(payload);
        break;
      case "connectionState":
        this.connected = payload.connected;
        this.notifyConnectionState();
        break;
      case "error":
        console.error("[WebSocket] Error from worker:", payload.error);
        break;
      case "connected":
        this.connected = payload.connected;
        this.notifyConnectionState();
        if (this.connectPromise) {
          this.connectPromise = Promise.resolve(payload.connected);
        }
        break;
    }
  }

  private handleMessage(data: any) {
    console.log("[WebSocket] Handling message:", data);
    const handler = this.messageHandlers.get(data.type);
    if (handler) {
      console.log("[WebSocket] Found handler for type:", data.type);
      handler(data);
    } else {
      console.warn("[WebSocket] No handler found for type:", data.type, "Available handlers:", [...this.messageHandlers.keys()]);
    }
  }

  private handleReady(data: ReadyPayload) {
    console.log("[WebSocket] Received READY payload:", JSON.stringify(data, null, 2));
    console.log("[WebSocket] Current messageHandlers:", [...this.messageHandlers.entries()]);

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
      console.warn("[WebSocket] No users data in READY payload or cache not initialized");
    }

    if (data.client_user) {
      console.log("[WebSocket] Client user data received:", data.client_user);
    } else {
      console.warn("[WebSocket] No client_user data in READY payload");
    }
  }

  private handleRelationship(payload: RelationshipPayload) {
    console.log("[WebSocketClient] Handling relationship event:", payload);

    const relationshipId = payload.relationship.id;
    console.log(
      `[WebSocketClient] Processing relationship ${relationshipId} for event type ${payload.type}`
    );

    if (!this.cache) {
      console.warn("[WebSocket] No cache available for relationship update");
      return;
    }

    const { sender, recipient } = payload.relationship;

    // Handle sender data if present
    if (sender && typeof sender === "object") {
      const normalizedSender = {
        id: sender.id,
        username: sender.username,
        discriminator: sender.discriminator,
        display_name: sender.display_name || sender.username,
        avatar: sender.avatar,
      };

      if (
        normalizedSender.id &&
        normalizedSender.username &&
        normalizedSender.discriminator
      ) {
        console.log("[WebSocket] Caching normalized sender:", normalizedSender);
        this.cache.setUsers({ [normalizedSender.id]: normalizedSender });
      } else {
        console.warn("[WebSocket] Invalid sender data:", sender);
      }
    }

    // Handle recipient data if present
    if (recipient && typeof recipient === "object") {
      const normalizedRecipient = {
        id: recipient.id,
        username: recipient.username,
        discriminator: recipient.discriminator,
        display_name: recipient.display_name || recipient.username,
        avatar: recipient.avatar,
      };

      if (
        normalizedRecipient.id &&
        normalizedRecipient.username &&
        normalizedRecipient.discriminator
      ) {
        console.log(
          "[WebSocket] Caching normalized recipient:",
          normalizedRecipient
        );
        this.cache.setUsers({ [normalizedRecipient.id]: normalizedRecipient });
      } else {
        console.warn("[WebSocket] Invalid recipient data:", recipient);
      }
    }

    // Update relationship requests based on event type
    switch (payload.type) {
      case "relationshipCreate":
        this.relationshipRequests[relationshipId] = payload.relationship;
        break;
      case "relationshipUpdate":
        this.relationshipRequests[relationshipId] = {
          ...this.relationshipRequests[relationshipId],
          ...payload.relationship,
        };
        break;
      case "relationshipAccept":
      case "relationshipDelete":
        // Remove from relationships if accepted or deleted
        delete this.relationshipRequests[relationshipId];
        break;
    }

    console.log("[WebSocketClient] Relationships updated:", this.relationships);

    // Emit relationship update event
    const handler = this.messageHandlers.get(payload.type);
    if (handler) {
      handler(payload);
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
      Array.from(this.cache.getUsers().keys())
    );
    handlePresenceUpdate(payload, this.cache);
  }

  public async connect(token: string): Promise<boolean> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve) => {
      if (WebSocketClient.isSharedWorkerSupported && this.worker) {
        console.log("[WebSocket] Sending connect message to worker with token");
        this.worker.port.postMessage({
          type: "connect",
          payload: { token }
        });
      } else {
        // Direct WebSocket connection when SharedWorker is not supported
        this.ws.onopen = () => {
          this.ws.send(JSON.stringify({
            type: "IDENTIFY",
            token,
            device: "mobile",
          }));
          this.connected = true;
          this.notifyConnectionState();
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

      if (WebSocketClient.isSharedWorkerSupported && this.worker) {
        this.worker.port.postMessage({ type: "send", payload });
      } else {
        this.ws.send(JSON.stringify(payload));
      }
      resolve();
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
