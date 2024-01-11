"use client";
import { Client } from "@strafechat/strafe.js";
import cookie from "js-cookie";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from 'react';

const ClientControllerContext = createContext<{ client: Client | null }>({
  client: null
});

export default function ClientController({ children }: { children: JSX.Element }) {

  const pathname = usePathname();

  const [client, setClient] = useState<Client | null>(null);
  const [ready, setReady] = useState(false);

  const init = () => {
    const client = new Client({
      config: {
        equinox: "http://localhost:443/v1"
      }
    });
    client.login(`${String(cookie.get("token")!)}`).catch(() => { });
    setClient(client);
  }

  useEffect(() => {
    if (!cookie.get("token")! && !["/login", "/register", "/verify"].includes(pathname)) window.location.href = "/login";
    else if (!client && !["/login", "/register", "/verify"].includes(pathname)) init();
  }, [client, pathname]);

  console.log(client);

  return (
    <ClientControllerContext.Provider value={{ client }}>
      {ready ? children : <></>}
    </ClientControllerContext.Provider>
  )
}

export const useClient = () => useContext(ClientControllerContext);