import { UserPresence } from "@strafechat/strafe.js";
import axios from 'axios';

export class Formatting {

    public static formatAvatar = (id: string | null | undefined, hash: string | null | undefined) => {
        if (!hash) {
            const randomNumber = Math.floor(Math.random() * 6) + 1;
            return `/defaultAvatars/avatar${randomNumber}.webp`;
            
        } else {
            const extension = hash.includes('_gif') ? '.gif' : '.png';
            return `${process.env.NEXT_PUBLIC_CDN}/avatars/${id}/${hash}`;
        }
    }

    public static formatDefaultAvatar = () => {
        const randomNumber = Math.floor(Math.random() * 6) + 1;
        return `/defaultAvatars/avatar${randomNumber}.webp`;
    }

    public static formatDiscrim = (discrim: string | number) => {
        return discrim.toString().padStart(4, "0");
    }
    
    public static formatStatusText = (presence: UserPresence) => {
        if (!presence.online || presence.status == "offline") return "Offline";
        return presence.status_text ? presence.status_text.trim() == '' ? presence.status.charAt(0).toUpperCase() + presence.status.slice(1) : presence.status_text : presence.status.charAt(0).toUpperCase() + presence.status.slice(1);
    }
}