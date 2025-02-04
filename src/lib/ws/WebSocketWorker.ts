/// <reference lib="webworker" />

import * as msgpack from "@msgpack/msgpack";
import { WS_URL } from "../../constants";

interface WebSocketMessage {
  type: "connect" | "disconnect" | "send" | "connectionState" | "init";
  payload?: any;
}

declare const self: SharedWorkerGlobalScope;

class WebSocketWorkerHandler {
  private ws: WebSocket | null = null;
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private baseReconnectDelay = 1000;
  private currentToken: string | null = null;
  private ports: Set<MessagePort> = new Set();
  private url: string;
  private loading = true;

  constructor(url: string = WS_URL) {
    this.url = url;
  }

  public handleConnect(token: string, port: MessagePort) {
    console.log(
      "[WebSocketWorker] Attempting to connect with token:",
      token.substring(0, 10) + "..."
    );

    // If we already have an active connection with the same token, just add the port
    if (this.ws?.readyState === WebSocket.OPEN && this.currentToken === token) {
      console.log("[WebSocketWorker] Reusing existing connection for new port");
      this.addPort(port);
      // Send a READY event to the new port to initialize its state
      this.notifyConnectionState(true, port);
      // Send an identify request to get the initial state for this port
      this.sendIdentify(token)
        .then(() => {
          console.log(
            "[WebSocketWorker] Identify sent successfully for new port"
          );
        })
        .catch((error) => {
          console.error(
            "[WebSocketWorker] Failed to send identify for new port:",
            error
          );
          this.notifyError(error, port);
        });
      return;
    }

    // If we have a different token or no connection, create a new one
    if (this.ws) {
      console.log(
        "[WebSocketWorker] Closing existing connection due to token change"
      );
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(this.url);
      this.currentToken = token;
      this.addPort(port);

      this.ws.onopen = () => {
        console.log("[WebSocketWorker] WebSocket connection opened");
        this.sendIdentify(token)
          .then(() => {
            console.log("[WebSocketWorker] Identify sent successfully");
            this.notifyConnectionState(true);
            this.startHeartbeat();
            this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          })
          .catch((error) => {
            console.error("[WebSocketWorker] Failed to send identify:", error);
            this.notifyConnectionState(false);
          });
      };

      this.ws.onmessage = (event: MessageEvent) => {
        console.log("[WebSocketWorker] Raw message received:", event.data);
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocketWorker] WebSocket error:", error);
        this.notifyConnectionState(false);
      };

      this.ws.onclose = (event) => {
        console.log("[WebSocketWorker] WebSocket closed:", event);
        this.notifyConnectionState(false);
        this.stopHeartbeat();
        // Only schedule reconnect if we still have ports
        if (this.ports.size > 0) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("[WebSocketWorker] Connection setup error:", error);
      this.notifyConnectionState(false);
    }
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
      `[WebSocketWorker] Scheduling reconnect attempt ${
        this.reconnectAttempts + 1
      } in ${delay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.currentToken && this.ports.size > 0) {
        console.log(
          `[WebSocketWorker] Attempting reconnect ${this.reconnectAttempts}`
        );
        // Use any port since we're maintaining a single connection
        const port = Array.from(this.ports)[0];
        // Reset reconnect attempts if we've been disconnected for a while
        if (this.reconnectAttempts > 5) {
          console.log("[WebSocketWorker] Resetting reconnect attempts");
          this.reconnectAttempts = 0;
        }
        this.handleConnect(this.currentToken, port);
      }
    }, delay) as unknown as number;
  }

  public addPort(port: MessagePort) {
    if (!this.ports.has(port)) {
      this.ports.add(port);
      port.onmessage = (event: MessageEvent<WebSocketMessage>) => {
        const { type, payload } = event.data;
        console.log(
          "[WebSocketWorker] Received message from port:",
          type,
          payload
        );
        switch (type) {
          case "init":
            this.url = payload.url;
            break;
          case "connect":
            this.handleConnect(payload.token, port);
            break;
          case "disconnect":
            this.handleDisconnect();
            break;
          case "send":
            this.send(payload).catch((error) => {
              console.error("[WebSocketWorker] Error sending message:", error);
              this.notifyError(error, port);
            });
            break;
        }
      };
      port.start();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    // Send initial heartbeat immediately
    if (this.isConnected()) {
      console.log("[WebSocketWorker] Sending initial heartbeat");
      const payload = {
        type: "HEARTBEAT",
        timestamp: Date.now(),
      };
      this.send(payload);
    }

    // Set up heartbeat interval (every 15 seconds instead of 45)
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        console.log("[WebSocketWorker] Sending heartbeat");
        const payload = {
          type: "HEARTBEAT",
          timestamp: Date.now(),
        };

        this.send(payload).catch((error) => {
          console.error("[WebSocketWorker] Heartbeat failed:", error);
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

  private sendIdentify(token: string): Promise<void> {
    console.log("[WebSocketWorker] Sending identify payload");
    return this.send({
      type: "IDENTIFY",
      token: token,
    });
  }

  private async handleMessage(event: MessageEvent) {
    console.log(
      "[WebSocketWorker] Handling message, event type:",
      typeof event.data
    );
    console.log("[WebSocketWorker] Raw message data:", event.data);

    try {
      let data: any;

      // Handle Blob data
      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Try MessagePack first
        try {
          data = msgpack.decode(uint8Array);
          console.log(
            "[WebSocketWorker] Successfully decoded with MessagePack:",
            data
          );
        } catch (msgpackError) {
          // Fallback to JSON if MessagePack fails
          try {
            const textDecoder = new TextDecoder("utf-8");
            const jsonString = textDecoder.decode(uint8Array);
            data = JSON.parse(jsonString);
            console.log(
              "[WebSocketWorker] Successfully decoded with JSON:",
              data
            );
          } catch (jsonError) {
            console.error("[WebSocketWorker] Failed to decode message:", {
              originalData: event.data,
              msgpackError,
              jsonError,
            });
            this.notifyError({
              message: "Failed to decode message",
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
            "[WebSocketWorker] Successfully decoded Uint8Array with JSON:",
            data
          );
        } catch (jsonError) {
          console.error("[WebSocketWorker] Failed to decode Uint8Array:", {
            originalData: event.data,
            jsonError,
          });
          this.notifyError({
            message: "Failed to decode Uint8Array",
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
        console.warn("[WebSocketWorker] Received non-standard payload:", data);
        data = {
          op: 0,
          d: data,
        };
      }

      console.log("[WebSocketWorker] Message details:", {
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
      };

      switch (data.op) {
        case OpCodes.READY:
          console.log("[WebSocketWorker] Received READY event:", data.d);
          this.loading = false;
          this.broadcast({
            type: "ready",
            payload: data.d,
          });
          break;

        case OpCodes.HEARTBEAT_ACK:
          console.log("[WebSocketWorker] Received HEARTBEAT_ACK");
          break;

        case OpCodes.RELATIONSHIP_CREATE:
          console.log(
            "[WebSocketWorker] Received RELATIONSHIP_CREATE raw data:",
            data
          );
          if (!data.d || !data.d.id) {
            console.error(
              "[WebSocketWorker] Invalid relationship data received:",
              data
            );
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
          console.log(
            "[WebSocketWorker] Raw relationship data:",
            data.d,
            "\nNormalized relationship:",
            relationship
          );

          this.broadcast({
            type: "relationshipCreate",
            payload: relationship,
          });
          break;

        case OpCodes.RELATIONSHIP_UPDATE:
          console.log(
            "[WebSocketWorker] Received RELATIONSHIP_UPDATE raw data:",
            data
          );
          if (!data.d || !data.d.id) {
            console.error(
              "[WebSocketWorker] Invalid relationship update data received:",
              data
            );
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
          console.log(
            "[WebSocketWorker] Raw relationship update data:",
            data.d,
            "\nNormalized relationship:",
            updatedRelationship
          );

          this.broadcast({
            type: "relationshipUpdate",
            payload: updatedRelationship,
          });
          break;

        case OpCodes.RELATIONSHIP_ACCEPT:
          console.log(
            "[WebSocketWorker] Received RELATIONSHIP_ACCEPT raw data:",
            data
          );
          if (!data.d || !data.d.id) {
            console.error(
              "[WebSocketWorker] Invalid relationship accept data received:",
              data
            );
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
          console.log(
            "[WebSocketWorker] Raw relationship accept data:",
            data.d,
            "\nNormalized relationship:",
            acceptedRelationship
          );

          this.broadcast({
            type: "relationshipAccept",
            payload: acceptedRelationship,
          });
          break;

        case OpCodes.RELATIONSHIP_DELETE:
          console.log(
            "[WebSocketWorker] Received RELATIONSHIP_DELETE raw data:",
            data
          );
          if (!data.d || !data.d.id) {
            console.error(
              "[WebSocketWorker] Invalid relationship delete data received:",
              data
            );
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
          console.log(
            "[WebSocketWorker] Raw relationship delete data:",
            data.d,
            "\nNormalized relationship:",
            deletedRelationship
          );

          this.broadcast({
            type: "relationshipDelete",
            payload: deletedRelationship,
          });
          break;

        case OpCodes.MESSAGE:
          console.log("[WebSocketWorker] Received MESSAGE:", data.d);
          this.broadcast({
            type: "message",
            payload: data.d,
          });
          break;

        case OpCodes.DISPATCH:
          console.log("[WebSocketWorker] Received DISPATCH:", data.d);
          // Handle legacy dispatch events
          if (data.d && data.d.op) {
            const messageEvent = new MessageEvent("message", {
              data: data.d,
              lastEventId: "",
              origin: "yourOrigin",
              ports: [],
            });
            this.handleMessage(messageEvent);
          } else {
            this.broadcast({
              type: "dispatch",
              payload: data.d,
            });
          }
          break;

        case OpCodes.PRESENCE_UPDATE:
          console.log(
            "[WebSocketWorker] Received PRESENCE_UPDATE raw data:",
            data
          );
          if (!data.d || !data.d.user_id) {
            console.error(
              "[WebSocketWorker] Invalid presence update data received:",
              data
            );
            break;
          }
          const presenceUpdate = {
            type: "presenceUpdate",
            user_id: data.d.user_id,
            status: data.d.status || "Offline",
            custom_status: data.d.custom_status || "",
          };
          console.log(
            "[WebSocketWorker] Normalized presence update:",
            presenceUpdate
          );

          this.broadcast({
            type: "dispatch",
            payload: presenceUpdate,
          });
          break;

        default:
          console.warn("[WebSocketWorker] Unhandled event type:", data.op);
          break;
      }
    } catch (error) {
      console.error(
        "[WebSocketWorker] Unexpected error handling message:",
        error
      );
      this.notifyError(error);
    }
  }

  private normalizePayload(data: any): any {
    // Normalize payload to use lowercase keys
    if (data && typeof data === "object") {
      const normalizedData: any = {};

      // Map uppercase keys to lowercase
      if ("Op" in data) normalizedData.op = data.Op;
      if ("D" in data) normalizedData.d = data.D;

      // Handle 't' field
      if ("t" in data) {
        normalizedData.op = this.mapEventTypeToOpCode(data.t);
        delete normalizedData.t;
      }

      // If no lowercase keys found, use original data
      return Object.keys(normalizedData).length > 0 ? normalizedData : data;
    }
    return data;
  }

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
    };

    return opCodeMap[eventType] || "DISPATCH";
  }

  private send(payload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      try {
        const processedPayload = Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [
            key,
            typeof value === "bigint" ? Number(value) : value,
          ])
        );

        const encodedPayload = msgpack.encode(processedPayload);
        this.ws.send(encodedPayload);
        resolve();
      } catch (error) {
        console.error("[WebSocketWorker] Error sending payload:", error);
        reject(error);
      }
    });
  }

  private isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public handleDisconnect() {
    this.stopHeartbeat();
    this.currentToken = null;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
  }

  private notifyConnectionState(
    connected: boolean,
    specificPort?: MessagePort
  ) {
    const message = {
      type: "connectionState",
      payload: { connected, loading: this.loading },
    };
    if (specificPort) {
      specificPort.postMessage(message);
    } else {
      this.broadcast(message);
    }
  }

  private notifyError(error: any, specificPort?: MessagePort) {
    const message = {
      type: "error",
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
    if (specificPort) {
      specificPort.postMessage(message);
    } else {
      this.broadcast(message);
    }
  }

  private broadcast(message: any) {
    console.log(
      "[WebSocketWorker] Broadcasting message to all ports:",
      message
    );
    this.ports.forEach((port) => {
      try {
        port.postMessage(message);
      } catch (error) {
        console.error(
          "[WebSocketWorker] Error broadcasting message to port:",
          error
        );
        // Remove the port if it's broken
        this.removePort(port);
      }
    });
  }

  public removePort(port: MessagePort) {
    this.ports.delete(port);
    if (this.ports.size === 0) {
      this.handleDisconnect();
    }
  }
}

const handler = new WebSocketWorkerHandler();

self.onconnect = function (e: MessageEvent) {
  const port = e.ports[0];
  handler.addPort(port);
  port.start();
};
