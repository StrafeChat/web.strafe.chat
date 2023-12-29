import { LinkProps } from "next/link";
import { Dispatch, SetStateAction } from "react";

export interface NavLinkProps extends LinkProps {
    children: JSX.Element | JSX.Element[] | string;
}

export interface Register {
    email: string;
    global_name?: string;
    username: string;
    discriminator: string | number;
    password: string;
    confirm_password: string;
    dob: string;
    captcha: string;
}

export interface UI {
    electron: boolean;
    hideRoomList: boolean;
    isMobile: boolean;
    setElectron: Dispatch<SetStateAction<boolean>>;
    setHideRoomList: Dispatch<SetStateAction<boolean>>;
    setIsMobile: Dispatch<SetStateAction<boolean>>;
}

export interface ModalControllerState {
    openModals: string[];
}

export interface ModalState {
    name: string;
    closeModal: (name: string) => void;
}