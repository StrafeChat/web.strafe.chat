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
  private readonly worker: SharedWorker;
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
  private static workerChannel: BroadcastChannel;
  private static activeWorker: SharedWorker | null = null;

  constructor(private readonly ws: WebSocket) {
    this.cache = new UserCache();

    // Create or join the coordination channel
    if (!WebSocketClient.workerChannel) {
      WebSocketClient.workerChannel = new BroadcastChannel(
        "strafe-websocket-worker"
      );
    }

    // Try to get existing worker or create new one
    if (!WebSocketClient.activeWorker) {
      WebSocketClient.activeWorker = new SharedWorker(
        new URL("./WebSocketWorker.ts", import.meta.url),
        {
          type: "module",
          name: "StrafeChat WebSocket Worker",
        }
      );

      // Notify other tabs that we've created a worker
      WebSocketClient.workerChannel.postMessage({ type: "worker-created" });
    }

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

    // Set up default message handlers
    this.messageHandlers.set("READY", this.handleReady.bind(this));
    console.log("[WebSocket] READY handler set");
    console.log("[WebSocket] Message handlers set up:", this.messageHandlers);
    this.onMessage("relationshipCreate", this.handleRelationship.bind(this));
    this.onMessage("relationshipUpdate", this.handleRelationship.bind(this));
    this.onMessage("relationshipAccept", this.handleRelationship.bind(this));
    this.onMessage("relationshipDelete", this.handleRelationship.bind(this));
    this.onMessage("PRESENCE_UPDATE", this.handlePresenceUpdate.bind(this));

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
    console.log("[WebSocket] handleWorkerMessage invoked");
    const { type, payload } = event.data;
    console.log("[WebSocket] Message type received:", type);
    console.log("[WebSocket] Received worker message:", type, payload);

    switch (type) {
      case "message":
      case "dispatch":
        console.log("[WebSocket] Processing message type:", payload.type);
        const handler = this.messageHandlers.get(payload.type);
        if (handler) {
          console.log("[WebSocket] Calling handler for type:", payload.type);
          console.log("[WebSocket] Handler function:", handler);
          handler(payload);
        } else {
          console.warn("[WebSocket] No handler found for type:", payload.type);
          console.log("[WebSocket] Available handlers:", [
            ...this.messageHandlers.keys(),
          ]);
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
        return;
      case "connectionState":
        this.connected = payload.connected;
        this.notifyConnectionState(payload.connected);
        break;
      case "error":
        console.error("[WebSocket] Error from worker:", payload.error);
        break;
    }
  }

  private handleReady(data: ReadyPayload) {
    console.log("[WebSocket] Received READY payload:", data);

    // Pass the full READY payload to any registered READY handlers
    const readyHandler = this.messageHandlers.get("READY");
    if (readyHandler) {
      readyHandler(data);
    }

    // Cache users if available
    if (data.users && this.cache) {
      this.cache.setUsers(data.users);
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

  public onConnectionStateChange(callback: (connected: boolean) => void) {
    this.connectionStateCallbacks.push(callback);
    // Immediately notify of current state if connected
    if (this.connected) {
      callback(true);
    }
  }

  private notifyConnectionState(connected: boolean) {
    console.log(`[WebSocket] Connection state changed: ${connected}`);
    this.connectionStateCallbacks.forEach((callback) => callback(connected));
  }

  public connect(token: string): Promise<boolean> {
    console.log("[WebSocket] Connect called with token");

    if (this.connected) {
      console.log("[WebSocket] Already connected");
      return Promise.resolve(true);
    }

    if (this.connectPromise) {
      console.log("[WebSocket] Already connecting");
      return this.connectPromise;
    }

    this.readyPromise = new Promise((resolve) => {
      const handler = (readyPayload: ReadyPayload) => {
        console.log("[WebSocket] Received READY payload:", readyPayload);
        this.messageHandlers.delete("READY");
        resolve(readyPayload);
      };
      this.onMessage("READY", handler);
    });

    this.connectPromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 10000);

      const connectionStateHandler = (connected: boolean) => {
        if (connected) {
          clearTimeout(timeout);
          this.readyPromise
            ?.then(() => {
              resolve(true);
            })
            .catch(reject);
        }
      };

      this.onConnectionStateChange(connectionStateHandler);
      this.worker.port.postMessage({ type: "connect", payload: { token } });
    });

    return this.connectPromise;
  }

  public send(payload: WSPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      this.worker.port.postMessage({ type: "send", payload });
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
    this.messageHandlers.clear();
    this.connectPromise = null;
    this.readyPromise = null;
    this.worker.port.postMessage({ type: "disconnect" });
  }

  public async getUserDetails(): Promise<ReadyPayload> {
    if (!this.readyPromise) {
      throw new Error("Not connected or authentication not complete");
    }
    return this.readyPromise;
  }
}
