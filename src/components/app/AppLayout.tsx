"use client";
import { useUI } from "@/providers/UIProvider";
import { usePathname } from "next/navigation";
import ElectronTitleBar from "../desktop/ElectronTitleBar";
import { ReactNode, useEffect } from "react";
import AppView from "./AppView";
import RoomList from "./RoomList";
import SpaceList from "./SpaceList";
import "./app.scss";
import { MOBILE_REGEX_CHECK } from "@/constants";

export default function AppLayout({
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

  const override = ["/login", "/register", "/forgot-password"];

  return override.includes(pathname) ? (
    <>{children}</>
  ) : (
    <div className="flex flex-col w-full h-full">
      {electron && <ElectronTitleBar />}
      <div className="app">
          <SpaceList />
          <RoomList />
          <AppView>{children}</AppView>
      </div>
    </div>
  );
}
