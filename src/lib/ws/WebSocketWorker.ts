/// <reference lib="webworker" />

import * as msgpack from "@msgpack/msgpack";

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

  constructor(url: string = "ws://localhost:8080/events") {
    this.url = url;
  }

  public handleConnect(token: string, port: MessagePort) {
    console.log("[WebSocketWorker] Connect called with token");
    this.currentToken = token;
    this.ports.add(port);

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[WebSocketWorker] Already connected");
      this.notifyConnectionState(true, port);
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.ws) {
        console.log("[WebSocketWorker] Closing existing connection");
        this.ws.close(1000, "Reconnecting");
        this.ws = null;
      }

      console.log("[WebSocketWorker] Creating new WebSocket connection");
      this.ws = new WebSocket(`${this.url}?format=msgpack`);
      this.ws.binaryType = "arraybuffer";

      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.log("[WebSocketWorker] Connection timeout");
          this.ws?.close();
          this.notifyError(new Error("Connection timeout"), port);
        }
      }, 10000);

      this.ws.onopen = () => {
        console.log("[WebSocketWorker] Connection opened");
        clearTimeout(connectionTimeout);
        this.reconnectAttempts = 0;
        this.sendIdentify(token)
          .then(() => {
            console.log("[WebSocketWorker] Connection fully established");
            this.startHeartbeat();
            this.notifyConnectionState(true, port);
          })
          .catch((error) => {
            console.error("[WebSocketWorker] Authentication failed:", error);
            this.notifyConnectionState(false, port);
            this.ws?.close(1000, "Authentication failed");
            this.notifyError(error, port);
          });
      };

      this.ws.onmessage = this.handleMessage.bind(this);

      this.ws.onerror = (error: Event) => {
        console.error("[WebSocketWorker] WebSocket error:", error);
        clearTimeout(connectionTimeout);
        this.notifyConnectionState(false, port);
        this.notifyError(error, port);
      };

      this.ws.onclose = (event: CloseEvent) => {
        console.log("[WebSocketWorker] WebSocket closed", event);
        clearTimeout(connectionTimeout);
        this.stopHeartbeat();
        this.ws = null;
        this.notifyConnectionState(false, port);

        if (this.currentToken && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("[WebSocketWorker] Connection error:", error);
      this.notifyError(error, port);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );

    console.log(
      `[WebSocketWorker] Scheduling reconnect attempt ${
        this.reconnectAttempts + 1
      } in ${delay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.currentToken) {
        console.log(
          `[WebSocketWorker] Attempting reconnect ${this.reconnectAttempts}`
        );
        const firstPort = Array.from(this.ports)[0];
        if (firstPort) {
          this.handleConnect(this.currentToken, firstPort);
        }
      }
    }, delay) as unknown as number;
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    if (this.isConnected()) {
      const payload = {
        type: "HEARTBEAT",
        timestamp: Date.now(),
      };
      this.send(payload);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
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
    }, 45000) as unknown as number;
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async sendIdentify(token: string): Promise<void> {
    const payload = {
      type: "IDENTIFY",
      token,
      device: "SharedWorker",
    };

    await this.send(payload);
  }

  private handleMessage(event: MessageEvent<any>) {
    try {
      const data = msgpack.decode(
        event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : new Uint8Array(Buffer.from(event.data))
      );

      console.log("[WebSocketWorker] Received message:", data);
      this.broadcast({ type: "message", payload: data });
    } catch (error) {
      console.error("[WebSocketWorker] Error handling message:", error);
      this.notifyError(error);
    }
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
    const message = { type: "connectionState", payload: { connected } };
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
    this.ports.forEach((port) => {
      try {
        port.postMessage(message);
      } catch (error) {
        console.error("[WebSocketWorker] Error broadcasting message:", error);
      }
    });
  }

  public addPort(port: MessagePort) {
    this.ports.add(port);
    port.onmessage = (event: MessageEvent<WebSocketMessage>) => {
      const { type, payload } = event.data;
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
            this.notifyError(error);
          });
          break;
      }
    };
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
