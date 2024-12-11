import { UserType } from "../../../types/users";

export const handleUserUpdate = (payload: UserType, cache: any) => {
  if (!payload.id) {
    console.error("[UserUpdate] Missing id in payload:", payload);
    return;
  }

  cache.setUser({
    id: payload.id,
    username: payload.username,
    discriminator: payload.discriminator,
    display_name: payload.display_name || payload.username,
    avatar: payload.avatar,
    presence: payload.presence || {
      status: "offline",
      online: false,
      custom_status: "",
    },
  });
};
