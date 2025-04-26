export const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000/v1";
export const FS_URL =
  import.meta.env.VITE_FILESYSTEM_URL || "http://localhost:4002/";
export const WS_URL =
  import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:4001/events?format=msgpack";

export const APP_VERSION = "0.1.3-INDEV";
