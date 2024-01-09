"use client";
import { Client } from "@strafechat/strafe.js";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from 'react';
import cookie from "js-cookie";

const ClientControllerContext = createContext<{ client: Client | null }>({
  client: null
});

export default function ClientController({ children }: { children: JSX.Element }) {

  const pathname = usePathname();

  const [client, setClient] = useState<Client | null>(null);

  const init = () => {
    const client = new Client({config: {
      equinox: "http://localhost:443/v1"
    }});
    console.log("Test!");
    client.login(cookie.get("token")!);
    setClient(client);
  }

  useEffect(() => {
    if(!cookie.get("token")! && !["/login", "/register", "/verify"].includes(pathname)) window.location.href = "/login";
    else if (!client && !["/login", "/register", "/verify"].includes(pathname)) init();
  }, [client, pathname]);

  return (
    <ClientControllerContext.Provider value={{ client }}>
      {children}
    </ClientControllerContext.Provider>
  )
}

export const useClient = () => useContext(ClientControllerContext);