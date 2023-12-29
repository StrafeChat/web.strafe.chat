"use client";
import { useUI } from "@/providers/UIProvider";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";
import AppView from "./AppView";
import RoomList from "./RoomList";
import SpaceList from "./SpaceList";
import "./app.scss";
import { MOBILE_REGEX_CHECK } from "@/constants";

export default function AppLayout({ children }: { children: JSX.Element | ReactNode }) {
    const pathname = usePathname();

    const { setElectron, setIsMobile, hideRoomList } = useUI();

    useEffect(() => {
        document.addEventListener("contextmenu", (event) => event.preventDefault());

        if (navigator.userAgent.toLowerCase().indexOf(" electron/") > -1) setElectron(true);
        if (MOBILE_REGEX_CHECK.test(navigator.userAgent)) setIsMobile(true);

        

        return () => document.removeEventListener("contextmenu", (event) => event.preventDefault());
    }, [setElectron]);

    const override = ["/login", "/register"];

    return override.includes(pathname) ? <>{children}</> : (
        <div className="app">
            <SpaceList />
            <RoomList />
            <AppView>{children}</AppView>
        </div>
    )
}