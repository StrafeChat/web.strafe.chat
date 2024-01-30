import { UserPresence } from "@strafechat/strafe.js";

export const formatDiscrim = (discrim: string | number) => {
    return discrim.toString().padStart(4, "0");
}

export const formatStatusText = (presence: UserPresence) => {
    if (!presence.online || presence.status == "offline") return "Offline";
    return presence.status_text ? presence.status_text.trim() == '' ? presence.status.charAt(0).toUpperCase() + presence.status.slice(1) : presence.status_text : presence.status.charAt(0).toUpperCase() + presence.status.slice(1);
}