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
    setElectron: Dispatch<SetStateAction<boolean>>;
    setHideRoomList: Dispatch<SetStateAction<boolean>>;
}