"use client";
import LoadingScreen from "@/components/app/Loading";
import { Client } from "@strafechat/strafe.js";
import cookie from "js-cookie";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from 'react';

const ClientControllerContext = createContext<{ client: Client | null }>({
  client: null
});

export default function ClientController({ children }: { children: JSX.Element }) {

  const pathname = usePathname();

  const client = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const init = () => {
    const clt = new Client({
      config: {
        equinox: "http://localhost:443/v1"
      }
    });
    clt.login(`${cookie.get("token")!}`);
    client.current = clt;
  }

  useEffect(() => {
    if (!cookie.get("token")! && !["/login", "/register"].includes(pathname)) window.location.href = "/login";
    else if (!client.current && !["/login", "/register"].includes(pathname)) init();
  }, [pathname]);

  if ((!client) && pathname !== "/login" && pathname !== "/register") {//ready event too
    return <LoadingScreen />;
  }

  return (
    <ClientControllerContext.Provider value={{ client: client.current }}>
      {children}
    </ClientControllerContext.Provider>
  )
}

export const useClient = () => useContext(ClientControllerContext);