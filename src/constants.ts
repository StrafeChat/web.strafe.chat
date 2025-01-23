export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
export const WS_URL =
  import.meta.env.WEBSOCKET_URL || "ws://localhost:8080/events?format=msgpack";
