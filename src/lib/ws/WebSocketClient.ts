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
import { decode } from "@msgpack/msgpack";

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
    console.log("[WebSocket] Message handlers set up:", [
      ...this.messageHandlers.entries(),
    ]);

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
        WebSocketClient.workerChannel = new BroadcastChannel(
          "strafe-websocket-worker"
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
      console.log(
        "[WebSocket] Using direct WebSocket connection (SharedWorker not supported)"
      );

      this.ws.onopen = () => {
        console.log("[WebSocket] Direct connection opened");
      };

      this.ws.onmessage = async (event) => {
        try {
          console.log(
            "[WebSocket] Received direct message, event type:",
            typeof event.data
          );
          console.log("[WebSocket] Raw message data:", event.data);

          let data: any;

          // Handle Blob data
          if (event.data instanceof Blob) {
            const arrayBuffer = await event.data.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Try MessagePack first
            try {
              data = decode(uint8Array);
              console.log(
                "[WebSocket] Successfully decoded with MessagePack:",
                data
              );
            } catch (msgpackError) {
              // Fallback to JSON if MessagePack fails
              try {
                const textDecoder = new TextDecoder("utf-8");
                const jsonString = textDecoder.decode(uint8Array);
                data = JSON.parse(jsonString);
                console.log(
                  "[WebSocket] Successfully decoded with JSON:",
                  data
                );
              } catch (jsonError) {
                console.error("[WebSocket] Failed to decode message:", {
                  originalData: event.data,
                  msgpackError,
                  jsonError,
                });
                return;
              }
            }
          } else if (event.data instanceof Uint8Array) {
            // Handle Uint8Array directly
            try {
              const textDecoder = new TextDecoder("utf-8");
              const jsonString = textDecoder.decode(event.data);
              data = JSON.parse(jsonString);
              console.log(
                "[WebSocket] Successfully decoded Uint8Array with JSON:",
                data
              );
            } catch (jsonError) {
              console.error("[WebSocket] Failed to decode Uint8Array:", {
                originalData: event.data,
                jsonError,
              });
              return;
            }
          } else if (typeof event.data === "string") {
            // Handle string data (JSON)
            data = JSON.parse(event.data);
          } else {
            // Handle other types of data
            data = event.data;
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

          console.log("[WebSocket] Message details:", {
            opCode: data.op,
            data: data.d,
          });

          const OpCodes = {
            READY: "READY",
            HEARTBEAT_ACK: "HEARTBEAT_ACK",
            RELATIONSHIP_CREATE: "relationshipCreate",
            RELATIONSHIP_UPDATE: "relationshipUpdate",
            RELATIONSHIP_ACCEPT: "relationshipAccept",
            RELATIONSHIP_DELETE: "relationshipDelete",
            MESSAGE: "MESSAGE",
            DISPATCH: "DISPATCH",
            PRESENCE_UPDATE: "PRESENCE_UPDATE",
          };

          switch (data.op) {
            case OpCodes.READY:
              console.log("[WebSocket] Received READY event:", data.d);
              const readyData = {
                ...data.d,
                type: "READY",
              };
              this.handleMessage(readyData);
              break;

            case OpCodes.HEARTBEAT_ACK:
              console.log("[WebSocket] Received HEARTBEAT_ACK");
              break;

            case OpCodes.RELATIONSHIP_CREATE:
              if (!data.d || !data.d.id) {
                console.error(
                  "[WebSocket] Invalid relationship data received:",
                  data
                );
                break;
              }
              const relationship = {
                type: OpCodes.RELATIONSHIP_CREATE,
                relationship: {
                  id: data.d.id,
                  sender_id: data.d.sender_id,
                  recipient_id: data.d.recipient_id,
                  created_at: data.d.created_at || new Date().toISOString(),
                  sender: data.d.sender || null,
                  recipient: data.d.recipient || null,
                },
              };
              this.handleMessage(relationship);
              break;

            case OpCodes.RELATIONSHIP_UPDATE:
            case OpCodes.RELATIONSHIP_ACCEPT:
            case OpCodes.RELATIONSHIP_DELETE:
              if (!data.d || !data.d.id) {
                console.error(
                  "[WebSocket] Invalid relationship data received:",
                  data
                );
                break;
              }
              const relationshipEvent = {
                type:
                  data.op === OpCodes.RELATIONSHIP_ACCEPT
                    ? OpCodes.RELATIONSHIP_ACCEPT
                    : data.op === OpCodes.RELATIONSHIP_UPDATE
                    ? OpCodes.RELATIONSHIP_UPDATE
                    : OpCodes.RELATIONSHIP_DELETE,
                relationship: {
                  id: data.d.id,
                  sender_id: data.d.sender_id,
                  recipient_id: data.d.recipient_id,
                  created_at: data.d.created_at || new Date().toISOString(),
                  sender: data.d.sender || null,
                  recipient: data.d.recipient || null,
                },
              };
              this.handleMessage(relationshipEvent);
              break;

            case OpCodes.PRESENCE_UPDATE:
              this.handleMessage(data.d);
              break;

            default:
              console.log("[WebSocket] Unhandled message type:", data.op);
              break;
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
    console.log(
      "[WebSocket] handleWorkerMessage invoked with data:",
      JSON.stringify(event.data, null, 2)
    );
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
          console.warn(
            "[WebSocket] No handler found for type:",
            payload.type,
            "Available handlers:",
            [...this.messageHandlers.keys()]
          );
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
      console.warn(
        "[WebSocket] No handler found for type:",
        data.type,
        "Available handlers:",
        [...this.messageHandlers.keys()]
      );
    }
  }

  private handleReady(data: ReadyPayload) {
    console.log(
      "[WebSocket] Received READY payload:",
      JSON.stringify(data, null, 2)
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
        "[WebSocket] No users data in READY payload or cache not initialized"
      );
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
      `[WebSocketClient] Processing relationship ${relationshipId} for event type ${payload.type}`
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
      Array.from(this.cache.getUsers().keys())
    );
    handlePresenceUpdate(payload, this.cache);
  }

  private normalizePayload(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.normalizePayload(item));
    } else if (typeof data === "object" && data !== null) {
      const normalized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1);
        normalized[normalizedKey] = this.normalizePayload(value);
      }
      return normalized;
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
      `[WebSocket] Scheduling reconnect attempt ${
        this.reconnectAttempts + 1
      } in ${delay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.currentToken) {
        console.log(
          `[WebSocket] Attempting reconnect ${this.reconnectAttempts}`
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

  public async connect(token: string): Promise<boolean> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.currentToken = token;
    this.connectPromise = new Promise((resolve) => {
      if (WebSocketClient.isSharedWorkerSupported && this.worker) {
        console.log("[WebSocket] Sending connect message to worker with token");
        this.worker.port.postMessage({
          type: "connect",
          payload: { token },
        });
      } else {
        // Direct WebSocket connection when SharedWorker is not supported
        this.ws.onopen = () => {
          console.log("[WebSocket] Direct connection opened, sending identify");
          this.ws.send(
            JSON.stringify({
              type: "IDENTIFY",
              token,
              device: "mobile",
            })
          );
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
