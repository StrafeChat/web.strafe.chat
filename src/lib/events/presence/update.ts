import { PresenceUpdatePayload } from "../../ws/WebSocketClient";
import { BASE_URL } from "../../../constants";

export const handlePresenceUpdate = async (
  payload: PresenceUpdatePayload,
  cache: any,
) => {
  console.log(
    "[PresenceUpdate] Handling presence update with payload:",
    payload,
  );

  if (!payload.user_id) {
    console.error("[PresenceUpdate] Missing user_id in payload:", payload);
    return;
  }

  // Check if user exists in cache
  const existingUser = cache.getUser(payload.user_id);
  if (!existingUser) {
    console.log("[PresenceUpdate] User not in cache, fetching user data:", payload.user_id);
    try {
      // Fetch user data from server
      const response = await fetch(`${BASE_URL}/users/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ user_ids: [payload.user_id] }),
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData.users && userData.users[payload.user_id]) {
          console.log("[PresenceUpdate] Fetched and caching user data:", userData.users[payload.user_id]);
          cache.setUsers({ [payload.user_id]: userData.users[payload.user_id] });
        }
      } else {
        console.error("[PresenceUpdate] Failed to fetch user data:", response.status);
      }
    } catch (error) {
      console.error("[PresenceUpdate] Error fetching user data:", error);
    }
  }

  console.log("[PresenceUpdate] Updating presence for user:", payload.user_id);
  cache.updateUserPresence(
    payload.user_id,
    payload.status,
    payload.custom_status || "",
  );
};
