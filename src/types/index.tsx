import { LinkProps } from "next/link";
import { Dispatch, SetStateAction } from "react";
import { Member, Message } from "@strafechat/strafe.js";
import { IconType } from "react-icons";
import type { Participant } from "livekit-client";

export interface NavLinkProps extends LinkProps {
    children: JSX.Element | JSX.Element[] | string;
    activate?: string[];
}

export interface ChatHeaderProps {
    name: string;
    icon?: IconType,
    type: "pm" | "server"
}

export interface MessageProps {
    message: Message;
    key: number;
    sameAuthor: boolean;
    showMoreOptions: boolean;
    ghost?: boolean;
    //setReferenceMessage: Dispatch<SetStateAction<any | null>>;
}

export interface VoiceHeaderProps {
    name: string;
    icon?: IconType,
    type: "pm" | "server"
}
export interface ParticipantTileProps {
  user: Member,
  participant: Participant,
  isLocal?: boolean,
  audioTrack?: MediaStreamTrack | null,
}

export interface Register {
    email: string;
    global_name?: string;
    username: string;
    discriminator: string | number;
    password: string;
    dob: string;
    captcha: string;
}

export interface Login {
    email: string;
    password: string;
}

export interface Verify {
    code: string;
}

export interface UI {
    electron: boolean;
    hideRoomList: boolean;
    isMobile: boolean;
    setElectron: Dispatch<SetStateAction<boolean>>;
    setHideRoomList: Dispatch<SetStateAction<boolean>>;
    setIsMobile: Dispatch<SetStateAction<boolean>>;
}

export interface IRoomContext {
    room: string;
    rooms: string[];
    setRoom: Dispatch<SetStateAction<string>>;
    setRooms: Dispatch<SetStateAction<string[]>>;
}

export interface ModalControllerState {
    openModals: {
        name: string;
        data?: any;
    }[];
}

export interface ModalState {
    name: string;
    closeModal: (name: string, data?: any) => void;
}
