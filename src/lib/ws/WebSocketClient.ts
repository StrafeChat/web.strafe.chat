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
  | "ROOM_UPDATE"
  | "SPACE_CREATE"
  | "MESSAGE_CREATE"
  | "MESSAGE_DELETE"
  | "MESSAGE_EDIT"
  | "TYPING_START"
  | "TYPING_INDICATOR";

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
  room_id: string;
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
  spaces?: any[];
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
  ROOM_UPDATE: "ROOM_UPDATE",
  SPACE_CREATE: "SPACE_CREATE",
  MESSAGE_CREATE: "MESSAGE_CREATE",
  MESSAGE_DELETE: "MESSAGE_DELETE",
  MESSAGE_EDIT: "MESSAGE_EDIT",
  TYPING_START: "TYPING_INDICATOR",
  TYPING_INDICATOR: "TYPING_INDICATOR"
};

export class WebSocketClient {
  private worker?: SharedWorker | null;
  private readonly messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectPromise: Promise<boolean> | null = null;
  private readyPromise: Promise<ReadyPayload> | null = null;
  private readonly connectionStateCallbacks: ((connected: boolean) => void)[] = [];
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
    // MESSAGE_CREATE is handled by AuthProvider to avoid conflicts
    this.onMessage("MESSAGE_DELETE", this.handleMessageDelete.bind(this));
    // MESSAGE_EDIT is handled by AuthProvider to avoid conflicts
    this.onMessage("ROOM_CREATE", this.handleRoomCreate.bind(this));
    this.onMessage("ROOM_DELETE", this.handleRoomDelete.bind(this));
    this.onMessage("ROOM_UPDATE", this.handleRoomUpdate.bind(this));
    this.onMessage("ROOM_MEMBER_ADD", this.handleRoomMemberAdd.bind(this));
    this.onMessage("ROOM_MEMBER_REMOVE", this.handleRoomMemberRemove.bind(this));
    this.onMessage("SPACE_CREATE", this.handleSpaceCreate.bind(this));
    this.onMessage("TYPING_INDICATOR", this.handleTypingIndicator.bind(this));    console.log("[WebSocket] Message handlers set up:", [...this.messageHandlers.entries()]);
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
      // Send identify immediately on open
      this.sendIdentify(this.currentToken!)
        .then(() => {
          console.log("[WebSocket] Identify sent successfully");
          this.connected = true;
          this.notifyConnectionState();
          // Start heartbeat after successful identify
          this.startHeartbeat();
          this.reconnectAttempts = 0;
        })
        .catch((error) => {
          console.error("[WebSocket] Failed to send identify:", error);
          this.connected = false;
          this.notifyConnectionState();
        });
    };

    this.ws.onmessage = this.handleDirectMessage.bind(this);

    this.ws.onclose = (event) => {
      console.log("[WebSocket] Direct connection closed:", event);
      this.connected = false;
      this.notifyConnectionState();
      this.stopHeartbeat();
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
          about_me: user.AboutMe,
          bio: user.Bio,
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

 private handleTypingIndicator(data: any): void {
    console.log("[WebSocket] Handling typing indicator:", data);
    const typingData = data.data || data;
    
    if (typingData.room_id && typingData.user_id) {
      console.log("[WebSocket] Dispatching typing indicator event:", typingData);
      
      // Dispatch event for UI updates
      this.dispatchEvent("typingIndicator", {
        roomId: typingData.room_id,
        userId: typingData.user_id,
        createdAt: typingData.created_at || new Date().toISOString()
      });
    }
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

      console.log("[WebSocket] Message details:", {
        opCode: data.op,
        data: data.d,
      });

      const OpCodes = {
        READY: "READY",
        HEARTBEAT_ACK: "HEARTBEAT_ACK",
        RELATIONSHIP_CREATE: "RELATIONSHIP_CREATE",
        RELATIONSHIP_UPDATE: "RELATIONSHIP_UPDATE",
        RELATIONSHIP_ACCEPT: "RELATIONSHIP_ACCEPT",
        RELATIONSHIP_DELETE: "RELATIONSHIP_DELETE",
        MESSAGE: "MESSAGE",
        DISPATCH: "DISPATCH",
        PRESENCE_UPDATE: "PRESENCE_UPDATE",
        MESSAGE_DELETE: "MESSAGE_DELETE",
        MESSAGE_EDIT: "MESSAGE_EDIT",
      };

      switch (data.op) {
        case OpCodes.READY:
          console.log("[WebSocket] Received READY event:", data.d);
          this.handleReady(data.d);
          break;

        case OpCodes.HEARTBEAT_ACK:
          console.log("[WebSocket] Received HEARTBEAT_ACK");
          break;

        case OpCodes.RELATIONSHIP_CREATE:
          console.log("[WebSocket] Received RELATIONSHIP_CREATE raw data:", data);
          if (!data.d || !data.d.id) {
            console.error("[WebSocket] Invalid relationship data received:", data);
            break;
          }
          const relationship = {
            id: data.d.id,
            sender_id: data.d.sender_id,
            recipient_id: data.d.recipient_id,
            created_at: data.d.created_at || new Date().toISOString(),
            type: "relationshipCreate",
            sender: data.d.sender || null,
            recipient: data.d.recipient || null,
          };
          console.log("[WebSocket] Processing relationshipCreate:", relationship);
          const relationshipCreateHandler = this.messageHandlers.get("relationshipCreate");
          if (relationshipCreateHandler) {
            relationshipCreateHandler(relationship);
          }
          break;

        case OpCodes.RELATIONSHIP_UPDATE:
          console.log("[WebSocket] Received RELATIONSHIP_UPDATE raw data:", data);
          if (!data.d || !data.d.id) {
            console.error("[WebSocket] Invalid relationship update data received:", data);
            break;
          }
          const updatedRelationship = {
            id: data.d.id,
            sender_id: data.d.sender_id,
            recipient_id: data.d.recipient_id,
            created_at: data.d.created_at || new Date().toISOString(),
            type: "relationshipUpdate",
            sender: data.d.sender || null,
            recipient: data.d.recipient || null,
          };
          console.log("[WebSocket] Processing relationshipUpdate:", updatedRelationship);
          const relationshipUpdateHandler = this.messageHandlers.get("relationshipUpdate");
          if (relationshipUpdateHandler) {
            relationshipUpdateHandler(updatedRelationship);
          }
          break;

        case OpCodes.RELATIONSHIP_ACCEPT:
          console.log("[WebSocket] Received RELATIONSHIP_ACCEPT raw data:", data);
          if (!data.d || !data.d.id) {
            console.error("[WebSocket] Invalid relationship accept data received:", data);
            break;
          }
          const acceptedRelationship = {
            id: data.d.id,
            sender_id: data.d.sender_id,
            recipient_id: data.d.recipient_id,
            created_at: data.d.created_at || new Date().toISOString(),
            type: "relationshipAccept",
            sender: data.d.sender || null,
            recipient: data.d.recipient || null,
          };
          console.log("[WebSocket] Processing relationshipAccept:", acceptedRelationship);
          const relationshipAcceptHandler = this.messageHandlers.get("relationshipAccept");
          if (relationshipAcceptHandler) {
            relationshipAcceptHandler(acceptedRelationship);
          }
          break;

        case OpCodes.RELATIONSHIP_DELETE:
          console.log("[WebSocket] Received RELATIONSHIP_DELETE raw data:", data);
          if (!data.d || !data.d.id) {
            console.error("[WebSocket] Invalid relationship delete data received:", data);
            break;
          }
          const deletedRelationship = {
            id: data.d.id,
            sender_id: data.d.sender_id,
            recipient_id: data.d.recipient_id,
            created_at: data.d.created_at || new Date().toISOString(),
            type: "relationshipDelete",
            sender: data.d.sender || null,
            recipient: data.d.recipient || null,
          };
          console.log("[WebSocket] Processing relationshipDelete:", deletedRelationship);
          const relationshipDeleteHandler = this.messageHandlers.get("relationshipDelete");
          if (relationshipDeleteHandler) {
            relationshipDeleteHandler(deletedRelationship);
          }
          break;

        case OpCodes.MESSAGE:
          console.log("[WebSocket] Received MESSAGE:", data.d);
          // Check if this is a message with the new nested data structure
          if (data.d && (data.d.type === "MESSAGE_CREATE" || data.d.event_type === "MESSAGE_CREATE") && data.d.data) {
            console.log("[WebSocket] Routing message_create to MESSAGE_CREATE handler");
            const messageCreateHandler = this.messageHandlers.get("MESSAGE_CREATE");
            if (messageCreateHandler) {
              messageCreateHandler({
                type: "MESSAGE_CREATE",
                data: data.d.data
              });
            }
          } else if (data.d && (data.d.type === "MESSAGE_DELETE" || data.d.event_type === "MESSAGE_DELETE") && data.d.data) {
            console.log("[WebSocket] Handling message delete:", data.d);
            this.handleMessageDelete({
              room_id: data.d.data.room_id,
              message_id: data.d.data.id
            });
          } else if (data.d && (data.d.type === "MESSAGE_EDIT" || data.d.event_type === "MESSAGE_EDIT") && data.d.data) {
            console.log("[WebSocket] Handling message edit:", data.d);
            const messageEditHandler = this.messageHandlers.get("MESSAGE_EDIT");
            if (messageEditHandler) {
              messageEditHandler({
                room_id: data.d.data.room_id,
                message_id: data.d.data.id,
                content: data.d.data.content,
                edited_at: data.d.data.edited_at,
                author_id: data.d.data.author_id
              });
            }
          } else {
            // Handle legacy message format
            const handler = this.messageHandlers.get("MESSAGE");
            if (handler) {
              handler(data.d);
            }
          }
          break;

        case OpCodes.DISPATCH:
          console.log("[WebSocket] Received DISPATCH:", data.d);
          // Handle legacy dispatch events
          if (data.d && data.d.op) {
            const messageEvent = new MessageEvent("message", {
              data: data.d,
              lastEventId: "",
              origin: "yourOrigin",
              ports: [],
            });
            this.handleDirectMessage(messageEvent);
          } 
          // Handle room creation events with nested data structure
          else if (data.d && (data.d.type === "ROOM_CREATE" || data.d.event_type === "ROOM_CREATE") && data.d.data) {
            this.handleRoomCreate(data.d);
          }
          // Handle room update events
          else if (data.d && (data.d.type === "ROOM_UPDATE" || data.d.event_type === "ROOM_UPDATE") && data.d.data) {
            this.handleRoomUpdate(data.d);
          }
          // Handle room delete events
          else if (data.d && (data.d.type === "ROOM_DELETE" || data.d.event_type === "ROOM_DELETE") && data.d.data) {
            this.handleRoomDelete(data.d);
          }
          // Handle room member add events
          else if (data.d && (data.d.type === "ROOM_MEMBER_ADD" || data.d.event_type === "ROOM_MEMBER_ADD") && data.d.data) {
            this.handleRoomMemberAdd(data.d);
          }
          // Handle room member remove events
          else if (data.d && (data.d.type === "ROOM_MEMBER_REMOVE" || data.d.event_type === "ROOM_MEMBER_REMOVE") && data.d.data) {
            this.handleRoomMemberRemove(data.d);
          }
          // Handle space creation events
          else if (data.d && (data.d.type === "SPACE_CREATE" || data.d.event_type === "SPACE_CREATE") && data.d.data) {
            this.handleSpaceCreate(data.d);
          }
          // Handle room ownership transfer events
          else if (data.d && (data.d.type === "ROOM_OWNERSHIP_TRANSFER" || data.d.event_type === "ROOM_OWNERSHIP_TRANSFER") && data.d.data) {
            const roomOwnershipHandler = this.messageHandlers.get("ROOM_OWNERSHIP_TRANSFER");
            if (roomOwnershipHandler) {
              console.log("[WebSocket] Routing roomOwnershipTransfer to ROOM_OWNERSHIP_TRANSFER handler");
              roomOwnershipHandler(data.d);
            }
          }
          // Handle room icon change events
          else if (data.d && (data.d.type === "ROOM_ICON_CHANGED" || data.d.event_type === "ROOM_ICON_CHANGED") && data.d.data) {
            this.handleRoomUpdate(data.d);
          }
          // Handle typing indicator events
          else if (data.d && (data.d.type === "TYPING_INDICATOR" || data.d.event_type === "TYPING_INDICATOR") && data.d.data) {
            this.handleTypingIndicator(data.d.data);
          }
          // Handle space member role update events
          else if (data.d && (data.d.type === "SPACE_MEMBER_ROLE_UPDATE" || data.d.event_type === "SPACE_MEMBER_ROLE_UPDATE") && data.d.data) {
            const handler = this.messageHandlers.get("SPACE_MEMBER_ROLE_UPDATE");
            if (handler) {
              handler(data.d);
            }
          }
          else {
            const handler = this.messageHandlers.get("DISPATCH");
            if (handler) {
              handler(data.d);
            }
          }
          break;

        case OpCodes.PRESENCE_UPDATE:
          console.log("[WebSocket] Received PRESENCE_UPDATE raw data:", data);
          if (!data.d || !data.d.user_id) {
            console.error("[WebSocket] Invalid presence update data received:", data);
            break;
          }
          const presenceUpdate = {
            type: "PRESENCE_UPDATE",
            user_id: data.d.user_id,
            status: data.d.status || "Offline",
            custom_status: data.d.custom_status || "",
          };
          console.log("[WebSocket] Processing presence update:", presenceUpdate);
          await this.handlePresenceUpdate({
            type: "PRESENCE_UPDATE",
            user_id: presenceUpdate.user_id,
            status: presenceUpdate.status,
            custom_status: presenceUpdate.custom_status
          } as PresenceUpdatePayload).catch((error: any) => {
            console.error("[WebSocket] Error handling presence update:", error);
          });
          break;

        default:
          console.warn("[WebSocket] Unhandled event type:", data.op);
          break;
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
    console.log("[WebSocket] Received worker message with type:", type, "and payload:", payload);

    switch (type) {
      case "message":
      case "dispatch":
        console.log("[WebSocket] Processing dispatch/message with payload.type:", payload?.type);
        // Handle presence updates specifically
        if (payload.type === "presenceUpdate") {
          console.log("[WebSocket] Handling presence update from worker:", payload);
          this.handlePresenceUpdate({
            type: "PRESENCE_UPDATE",
            user_id: payload.user_id,
            status: payload.status,
            custom_status: payload.custom_status
          }).catch((error: any) => {
            console.error("[WebSocket] Error handling presence update from worker:", error);
          });
        } else {
          const handler = this.messageHandlers.get(payload.type);
          if (handler) {
            handler(payload);
          } else {
            console.warn("[WebSocket] No handler for message type:", payload.type);
          }
        }
        break;

      case "message_create":
        // Route message_create events to MESSAGE_CREATE handler registered by AuthProvider
        console.log("[WebSocket] Received message_create event with payload:", payload);
        const messageCreateHandler = this.messageHandlers.get("MESSAGE_CREATE");
        console.log("[WebSocket] Available handlers:", [...this.messageHandlers.keys()]);
        if (messageCreateHandler) {
          console.log("[WebSocket] Routing message_create to MESSAGE_CREATE handler");
          messageCreateHandler(payload);
        } else {
          console.warn("[WebSocket] No MESSAGE_CREATE handler registered");
        }
        break;

      case "message_delete":
        // Directly call the message delete handler
        this.handleMessageDelete(payload);
        break;

      case "message_edit":
        // Route message_edit events to MESSAGE_EDIT handler registered by AuthProvider
        const messageEditHandler = this.messageHandlers.get("MESSAGE_EDIT");
        if (messageEditHandler) {
          console.log("[WebSocket] Routing message_edit to MESSAGE_EDIT handler");
          messageEditHandler(payload);
        } else {
          console.warn("[WebSocket] No MESSAGE_EDIT handler registered");
        }
        break;
       
        case "typing_indicator":
        // Directly call the typing indicator handler
        this.handleTypingIndicator(payload);
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

      case "roomDelete":
        this.handleRoomDelete(payload);
        break;

      case "roomUpdate":
        this.handleRoomUpdate(payload);
        break;

      case "roomMemberAdd":
        this.handleRoomMemberAdd(payload);
        break;

      case "roomMemberRemove":
        this.handleRoomMemberRemove(payload);
        break;

      case "roomOwnershipTransfer":
        // Call the registered ROOM_OWNERSHIP_TRANSFER handler directly
        const roomOwnershipHandler = this.messageHandlers.get("ROOM_OWNERSHIP_TRANSFER");
        if (roomOwnershipHandler) {
          console.log("[WebSocket] Routing roomOwnershipTransfer to ROOM_OWNERSHIP_TRANSFER handler");
          roomOwnershipHandler(payload);
        } else {
          console.warn("[WebSocket] No ROOM_OWNERSHIP_TRANSFER handler registered");
        }
        break;

      case "spaceCreate":
        // Call the registered SPACE_CREATE handler directly
        const spaceCreateHandler = this.messageHandlers.get("SPACE_CREATE");
        if (spaceCreateHandler) {
          console.log("[WebSocket] Routing spaceCreate to SPACE_CREATE handler");
          spaceCreateHandler(payload);
        } else {
          console.warn("[WebSocket] No SPACE_CREATE handler registered");
        }
        break;

      case "ready":
        this.handleReady(payload);
        break;

      case "connectionState":
      case "connected":
        this.connected = payload.connected;
        this.notifyConnectionState();
        if (type === "connected" && this.connectPromise) {
          this.connectPromise = Promise.resolve(payload.connected);
        }
        break;

      case "error":
        console.error("[WebSocket] Error from worker:", payload.error);
        break;
    }
  }

  private handleRoomCreate(data: any): void {
    console.log("[WebSocket] Handling room create:", data);
    const roomData = data.data || data;
    if (roomData.id) {
      console.log("[WebSocket] Dispatching room create event:", roomData);
      // Dispatch both 'roomCreate' and 'ROOM_CREATE' events to ensure compatibility
      this.dispatchEvent("roomCreate", {
        id: roomData.id,
        name: roomData.name || "",
        type: roomData.type || 0,
        recipients: roomData.recipients || [],
        owner_id: roomData.creator || roomData.owner_id || "",
        last_message_id: roomData.last_message_id || null,
        icon: roomData.icon || null,
        created_at: roomData.created_at || new Date().toISOString(),
        updated_at: roomData.updated_at || null
      });
      
      // Also call the message handler directly to ensure it's processed
      const roomCreateHandler = this.messageHandlers.get("ROOM_CREATE");
      if (roomCreateHandler) {
        roomCreateHandler(roomData);
      }
    }
  }

  private handleRoomDelete(data: any): void {
    console.log("[WebSocket] Handling room delete:", data);
    const roomData = data.data || data;
    if (roomData.room_id) {
      console.log("[WebSocket] Dispatching room delete event:", roomData);
      // Call the registered ROOM_DELETE handler directly
      const roomDeleteHandler = this.messageHandlers.get("ROOM_DELETE");
      if (roomDeleteHandler) {
        roomDeleteHandler(roomData);
      }
    }
  }

  private handleRoomUpdate(data: any): void {
    console.log("[WebSocket] Handling room update:", data);
    const roomData = data.data || data;
    if (roomData.room_id) {
      console.log("[WebSocket] Dispatching room update event:", roomData);
      // Call the registered ROOM_UPDATE handler directly
      const roomUpdateHandler = this.messageHandlers.get("ROOM_UPDATE");
      if (roomUpdateHandler) {
        roomUpdateHandler(roomData);
      }
    }
  }

  private handleRoomMemberAdd(data: any): void {
    console.log("[WebSocket] Handling room member add:", data);
    const roomData = data.data || data;
    if (roomData.room_id && roomData.user_id) {
      console.log("[WebSocket] Dispatching room member add event:", roomData);
      // Call the registered ROOM_MEMBER_ADD handler directly
      const roomMemberAddHandler = this.messageHandlers.get("ROOM_MEMBER_ADD");
      if (roomMemberAddHandler) {
        roomMemberAddHandler(roomData);
      }
    }
  }

  private handleRoomMemberRemove(data: any): void {
    console.log("[WebSocket] Handling room member remove:", data);
    const roomData = data.data || data;
    if (roomData.room_id && roomData.user_id) {
      console.log("[WebSocket] Dispatching room member remove event:", roomData);
      // Call the registered ROOM_MEMBER_REMOVE handler directly
      const roomMemberRemoveHandler = this.messageHandlers.get("ROOM_MEMBER_REMOVE");
      if (roomMemberRemoveHandler) {
        roomMemberRemoveHandler(roomData);
      }
    }
  }

  private handleSpaceCreate(data: any): void {
    console.log("[WebSocket] Handling space create:", data);
    const spaceData = data.data || data;
    if (spaceData.id) {
      console.log("[WebSocket] Dispatching space create event:", spaceData);
      
      // Dispatch spaceCreate event for the cache provider
      this.dispatchEvent("spaceCreate", {
        id: spaceData.id,
        name: spaceData.name || "",
        name_acronym: spaceData.name_acronym || "",
        description: spaceData.description || "",
        icon: spaceData.icon || null,
        banner: spaceData.banner || null,
        owner_id: spaceData.owner_id || "",
        verification_level: spaceData.verification_level || 0,
        default_message_notifications: spaceData.default_message_notifications || 0,
        explicit_content_filter: spaceData.explicit_content_filter || 0,
        features: spaceData.features || [],
        afk_room_id: spaceData.afk_room_id || null,
        afk_timeout: spaceData.afk_timeout || 0,
        system_room_id: spaceData.system_room_id || null,
        system_room_flags: spaceData.system_room_flags || 0,
        rules_room_id: spaceData.rules_room_id || null,
        max_presences: spaceData.max_presences || null,
        max_members: spaceData.max_members || null,
        vanity_url_code: spaceData.vanity_url_code || null,
        preferred_locale: spaceData.preferred_locale || "en-US",
        public_updates_room_id: spaceData.public_updates_room_id || null,
        max_video_room_users: spaceData.max_video_room_users || null,
        nsfw_level: spaceData.nsfw_level || 0,
        created_at: spaceData.created_at || new Date().toISOString(),
        updated_at: spaceData.updated_at || new Date().toISOString()
      });
      
      // Also call the message handler directly to ensure it's processed
      const spaceCreateHandler = this.messageHandlers.get("SPACE_CREATE");
      if (spaceCreateHandler) {
        spaceCreateHandler(spaceData);
      }
    }
  }

  // private handleMessageCreate(data: any): void {
  //   console.log("[WebSocket] Handling message create:", data);
  //   const messageData = data.data || data;
  //   if (messageData.room_id) {
  //     console.log("[WebSocket] Dispatching message create event:", messageData);
  //     console.log("[WebSocket] Message type debug:", {
  //       originalType: messageData.type,
  //       typeOfType: typeof messageData.type,
  //       systemType: messageData.system_type,
  //       systemData: messageData.system_data
  //     });
  //     this.dispatchEvent("messageCreate", {
  //       roomId: messageData.room_id,
  //       message: {
  //         id: messageData.id || "",
  //         content: messageData.content || "",
  //         author_id: messageData.author_id || messageData.sender_id || "",
  //         room_id: messageData.room_id,
  //         created_at: messageData.created_at || new Date().toISOString(),
  //         edited_at: messageData.edited_at || null,
  //         attachments: messageData.attachments || [],
  //         author: messageData.author || null,
  //         message_refrences: messageData.message_refrences || [],
  //         type: messageData.type,
  //         system_type: messageData.system_type,
  //         system_data: messageData.system_data
  //       }
  //     });
  //   }
  // }

  private handleMessageDelete(data: any): void {
    console.log("[WebSocket] Handling message delete:", data);
    const messageData = data.data || data;
    if (messageData.room_id && messageData.message_id) {
      console.log("[WebSocket] Dispatching message delete event:", messageData);
      
      // Dispatch event for UI updates
      this.dispatchEvent("messageDelete", {
        roomId: messageData.room_id,
        messageId: messageData.message_id
      });
      
      // Remove the message from cache
      if (this.cache) {
        // Access the MessageCache through the UserCache if available
        const messageCache = window.messageCache;
        if (messageCache) {
          messageCache.deleteMessage(messageData.room_id, messageData.message_id);
        }
      }
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
      console.log('[WebSocket] Raw bulk user response:', userData);
      if (userData && userData.users) {
        console.log('[WebSocket] Users from bulk response:', userData.users);
        console.log('[WebSocket] Sample user data:', Object.values(userData.users)[0]);
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
      console.log("[WebSocket] READY users data:", data.users);
      console.log("[WebSocket] Sample READY user:", Object.values(data.users)[0]);
      this.cache.setUsers(data.users);
    }

    // Cache spaces if available
    if (data.spaces && this.cache) {
      console.log("[WebSocket] Caching spaces:", data.spaces.length);
      console.log("[WebSocket] READY spaces data:", data.spaces);
      data.spaces.forEach((space: any) => {
        const spaceData = {
          id: space.id || space.ID,
          name: space.name || space.Name,
          name_acronym: space.name_acronym || space.NameAcronym || "",
          description: space.description || space.Description,
          owner_id: space.owner_id || space.OwnerID,
          created_at: space.created_at || space.CreatedAt,
          updated_at: space.updated_at || space.UpdatedAt,
          verification_level: space.verification_level || space.VerificationLevel || 0,
          default_message_notifications: space.default_message_notifications || space.DefaultMessageNotifications || 0,
          explicit_content_filter: space.explicit_content_filter || space.ExplicitContentFilter || 0,
          features: space.features || space.Features || [],
          afk_timeout: space.afk_timeout || space.AfkTimeout || 300,
          icon: space.icon || space.Icon || null,
          banner: space.banner || space.Banner || null,
          afk_room_id: space.afk_room_id || space.AfkRoomID || null,
          system_room_id: space.system_room_id || space.SystemRoomID || null
        };
        
        // Cache space members if they exist in the space object from Stargate
        if (space.members && Array.isArray(space.members)) {
          console.log(`[WebSocket] Caching ${space.members.length} members for space ${spaceData.id}`);
          
          // Extract and cache user data from space members
          const usersToCache: { [key: string]: any } = {};
          
          const normalizedMembers = space.members.map((member: any) => {
            const userId = member.user_id || member.UserID;
            const userData = member.user || member.User;
            
            // If we have user data, add it to the users cache
            if (userData && userId) {
              usersToCache[userId] = {
                id: userData.id || userData.ID || userId,
                username: userData.username || userData.Username,
                display_name: userData.display_name || userData.DisplayName || userData.username || userData.Username,
                discriminator: userData.discriminator || userData.Discriminator || 0,
                avatar: userData.avatar || userData.Avatar || '',
                banner: userData.banner || userData.Banner || '',
                bot: userData.bot || userData.Bot || false,
                system: userData.system || userData.System || false,
                bio: userData.bio || userData.Bio || '',
                about_me: userData.about_me || userData.AboutMe || '',
                flags: userData.flags || userData.Flags || 0,
                presence: userData.presence || userData.Presence || {
                  status: 'offline',
                  custom_status: ''
                }
              };
            }
            
            return {
              space_id: member.space_id || member.SpaceID || String(spaceData.id),
              user_id: userId,
              nick: member.nick || member.Nick,
              avatar: member.avatar || member.Avatar,
              roles: member.roles || member.Roles || [],
              joined_at: member.joined_at || member.JoinedAt,
              deaf: member.deaf || member.Deaf || false,
              mute: member.mute || member.Mute || false,
              flags: member.flags || member.Flags || 0,
              pending: member.pending || member.Pending || false,
              user: userData || {
                id: userId,
                username: `user_${userId}`,
                display_name: `User ${userId}`,
                discriminator: 0,
                avatar: '',
                banner: '',
                bot: false,
                system: false,
                bio: '',
                about_me: '',
                flags: 0,
                presence: {
                  status: 'offline',
                  custom_status: ''
                }
              }
            };
          });
          
          // Cache the extracted user data
          if (Object.keys(usersToCache).length > 0) {
            console.log(`[WebSocket] Caching ${Object.keys(usersToCache).length} users from space members`);
            this.cache.setUsers(usersToCache);
          }
          
          // Dispatch event for CacheProvider to handle
          this.dispatchEvent("spaceMembersCache", {
            spaceId: String(spaceData.id),
            members: normalizedMembers
          });
        }
        
        // Cache space roles if they exist in the space object from Stargate
        if (space.roles && Array.isArray(space.roles)) {
          console.log(`[WebSocket] Caching ${space.roles.length} roles for space ${spaceData.id}`);
          const normalizedRoles = space.roles.map((role: any) => ({
            space_id: role.space_id || role.SpaceID || String(spaceData.id),
            role_id: role.role_id || role.RoleID,
            name: role.name || role.Name,
            color: role.color || role.Color,
            permissions: role.permissions || role.Permissions || [],
            position: role.position || role.Position || 0,
            mentionable: role.mentionable || role.Mentionable || false,
            hoist: role.hoist || role.Hoist || false,
            created_at: role.created_at || role.CreatedAt,
            updated_at: role.updated_at || role.UpdatedAt
          }));
          // Dispatch event for CacheProvider to handle
          this.dispatchEvent("spaceRolesCache", {
            spaceId: String(spaceData.id),
            roles: normalizedRoles
          });
        }
        
        // Dispatch space create event for the cache provider to handle
        this.dispatchEvent("spaceCreate", spaceData);
      });
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
          bio: data.client_user.bio || data.client_user.Bio,
          about_me: data.client_user.about_me || data.client_user.AboutMe,
          created_at: data.client_user.created_at || data.client_user.CreatedAt,
          updated_at: data.client_user.updated_at || data.client_user.UpdatedAt,
          flags: data.client_user.flags || data.client_user.Flags || 0,
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

  private async handlePresenceUpdate(payload: PresenceUpdatePayload): Promise<void> {
    console.log("[WebSocketClient] Handling presence update:", payload);
    if (!this.cache) {
      console.warn("[WebSocketClient] No cache available for presence update");
      return;
    }
    await handlePresenceUpdate(payload, this.cache);
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

  private async sendIdentify(token: string): Promise<void> {
    if (!token) {
      throw new Error("No token provided for identify");
    }
    
    console.log("[WebSocket] Sending identify with token:", token.substring(0, 10) + "...");
    
    const payload: IdentifyPayload = {
      type: "IDENTIFY",
      token: token,
      device: navigator.userAgent
    };
    
    return this.send(payload);
  }
}