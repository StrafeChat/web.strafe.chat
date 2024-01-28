import { LinkProps } from "next/link";
import { Dispatch, SetStateAction } from "react";
import { IconType } from "react-icons";

export interface NavLinkProps extends LinkProps {
    children: JSX.Element | JSX.Element[] | string;
}

export interface ChatHeaderProps {
    name: string;
    icon?: IconType,
    type: "pm" | "server"
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
    closeModal: (name: string) => void;
}