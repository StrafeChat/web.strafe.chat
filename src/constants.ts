export const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:443/v1";
export const FS_URL =
  import.meta.env.VITE_FILESYSTEM_URL || "http://localhost:4000/";
export const WS_URL =
  import.meta.env.WEBSOCKET_URL || "ws://localhost:8080/events?format=msgpack";
