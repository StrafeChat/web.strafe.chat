"use client";
import { Client } from "@strafechat/strafe.js";
import cookie from "js-cookie";
import LoadingScreen from "@/components/app/Loading";
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
    client.login(`${cookie.get("token")!}`);
    setClient(client);
  }

  useEffect(() => {
    if (!cookie.get("token")! && !["/login", "/register"].includes(pathname)) window.location.href = "/login";
    else if (!client && !["/login", "/register"].includes(pathname)) init();
  }, [client, pathname]);

  if ((!client /*|| clientError || ready*/) && pathname !== "/login" && pathname !== "/register") {
    return <LoadingScreen />;
  }

  return (
    <ClientControllerContext.Provider value={{ client }}>
      {children}
    </ClientControllerContext.Provider>
  )
}

export const useClient = () => useContext(ClientControllerContext);