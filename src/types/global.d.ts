import { MessageCache } from "../lib/cache/MessageCache";

declare global {
  interface Window {
    messageCache: MessageCache;
  }
}