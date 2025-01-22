import { PresenceUpdatePayload } from "../../ws/WebSocketClient";

export const handlePresenceUpdate = (payload: PresenceUpdatePayload, cache: any) => {
  console.log("[PresenceUpdate] Handling presence update with payload:", payload);
  
  if (!payload.user_id) {
    console.error("[PresenceUpdate] Missing user_id in payload:", payload);
    return;
  }

  console.log("[PresenceUpdate] Updating presence for user:", payload.user_id);
  cache.updateUserPresence(
    payload.user_id,
    payload.status,
    payload.custom_status || ""
  );
};
