import { PresencePayload } from "../../../types/presence";

export const handlePresenceUpdate = (payload: PresencePayload, cache: any) => {
  if (!payload.user_id) {
    console.error("[PresenceUpdate] Missing user_id in payload:", payload);
    return;
  }

  const user = cache.getUser(payload.user_id);
  if (user) {
    cache.setUser({
      ...user,
      presence: {
        status: payload.status,
        online: payload.online,
        custom_status: payload.custom_status || "",
      },
    });
  }
};
