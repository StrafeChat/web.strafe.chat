"use client";
import { MOBILE_REGEX_CHECK } from "@/constants";
import { useUI } from "@/providers/UIProvider";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { AppView, ElectronTitleBar } from ".";
import "../../styles/app.scss";
import SpaceList from "../spaces/SpaceList";
import RoomList from "../rooms/RoomList";
import MemberList from "../chat/MemberList";

export function AppLayout({
  children,
}: {
  children: JSX.Element | ReactNode;
}) {
  const pathname = usePathname();

  const { setElectron, setIsMobile, electron } = useUI();

  useEffect(() => {
    document.addEventListener("contextmenu", (event) => event.preventDefault());

    if (navigator.userAgent.toLowerCase().indexOf(" electron/") > -1)
      setElectron(true);
    if (MOBILE_REGEX_CHECK.test(navigator.userAgent)) setIsMobile(true);

    return () =>
      document.removeEventListener("contextmenu", (event) =>
        event.preventDefault()
      );
  }, [setElectron, setIsMobile]);

  const override = ["/login", "/register", "/forgot-password", "/invites"];

return override.some(overridePath => pathname!.startsWith(overridePath)) ? (
  <>{children}</>
) : (
  <div className="h-full">
    {electron && <ElectronTitleBar />}
    <div className="app">
      <SpaceList />
      <RoomList />
      <AppView children={children}/>
    </div>
  </div>
);
}
