import { PresenceUpdatePayload } from "../../ws/WebSocketClient";

export const handlePresenceUpdate = (
  payload: PresenceUpdatePayload,
  cache: any
) => {
  console.log(
    "[PresenceUpdate] Handling presence update with payload:",
    payload
  );

  if (!payload.user_id) {
    console.error("[PresenceUpdate] Missing user_id in payload:", payload);
    return;
  }
  // const currentUser = user();
  // if (currentUser && payload.user_id === currentUser.id) {
  //   setUser({
  //     ...currentUser,
  //     presence: {
  //       status: payload.status,
  //       custom_status: payload.custom_status,
  //     },
  //   });
  //   console.log("[PresenceUpdate] Presence update for self");
  //   return;
  // }

  console.log("[PresenceUpdate] Updating presence for user:", payload.user_id);
  cache.updateUserPresence(
    payload.user_id,
    payload.status,
    payload.custom_status || ""
  );
};
