export type PayloadType = "IDENTIFY" | "HEARTBEAT" | "MESSAGE" | "READY";

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
}

export type WSPayload =
  | IdentifyPayload
  | HeartbeatPayload
  | MessagePayload
  | ReadyPayload;

export class WebSocketClient {
  private readonly worker: SharedWorker;
  private readonly messageHandlers: Map<PayloadType, (data: any) => void> =
    new Map();
  private connectPromise: Promise<boolean> | null = null;
  private readyPromise: Promise<ReadyPayload> | null = null;
  private readonly connectionStateCallbacks: ((connected: boolean) => void)[] =
    [];
  private connected = false;

  constructor(private readonly wsUrl: string = "ws://localhost:8080/events") {
    this.worker = new SharedWorker(
      new URL("./WebSocketWorker.ts", import.meta.url),
      {
        type: "module",
        name: "StrafeChat WebSocket Worker",
      }
    );

    this.worker.port.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.port.start();

    this.worker.port.postMessage({
      type: "init",
      payload: { url: this.wsUrl },
    });
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { type, payload } = event.data;

    switch (type) {
      case "message":
        const handler = this.messageHandlers.get(payload.type as PayloadType);
        if (handler) {
          handler(payload);
        }
        break;
      case "connectionState":
        this.connected = payload.connected;
        this.notifyConnectionState(payload.connected);
        break;
      case "error":
        console.error("[WebSocket] Error from worker:", payload.error);
        break;
    }
  }

  public onConnectionStateChange(callback: (connected: boolean) => void) {
    this.connectionStateCallbacks.push(callback);
  }

  private notifyConnectionState(connected: boolean) {
    console.log(`[WebSocket] Connection state changed: ${connected}`);
    this.connectionStateCallbacks.forEach((callback) => {
      console.log(`[WebSocket] Notifying callback of state: ${connected}`);
      callback(connected);
    });
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

  public onMessage(type: PayloadType, handler: (data: any) => void) {
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
