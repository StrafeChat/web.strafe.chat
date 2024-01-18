"use client";
import EmailVerifcation from "@/components/app/EmailVerifcation";
import LoadingScreen from "@/components/app/Loading";
import { useToast } from "@/components/ui/use-toast";
import { Client } from "@strafechat/strafe.js";
import cookie from "js-cookie";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { useForceUpdate } from "../hooks";

export const ClientControllerContext = createContext<{ client: Client | null }>({
  client: null,
});

export default function ClientController({ children }: { children: JSX.Element }) {

  const pathname = usePathname();

  const [client, setClient] = useState<Client | null>(null);
  const [ready, setReady] = useState(false);
  const [clientError, setClientError] = useState(false);
  const [verified, setVerified] = useState(false);
  const connected = useRef(false);

  const forceUpdate = useForceUpdate();

  const { toast } = useToast();

  const handleReady = useCallback(() => {
    setReady(true);
    setClientError(false);
    setVerified(client!.user?.verified || false);
  }, [client])

  const handlePresenceUpdate = useCallback((data: any) => {
    if (client!.user && data.user.id == client!.user.id) {
      client!.user.presence = data.presence;
      forceUpdate();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const init = () => {

    const clt = new Client({
      config: {
        equinox: "http://localhost:443/v1"
      }
    });

    setClient(clt);

    clt.login(cookie.get("token")!);

    clt.on("error", (err) => {
      if (err.code == 4004) {
        cookie.remove("token");
        window.location.href = "/login";
      } else {
        setClientError(true);
        setTimeout(() => {
          toast({
            title: "Something went wrong!",
            description: err.message,
            duration: 5000,
            className: "bg-destructive"
          });
        }, 1000);
      }
    });

    connected.current = true;
  }

  useEffect(() => {
    client?.on("ready", handleReady);
    client?.on("presenceUpdate", handlePresenceUpdate);

    return () => {
      client?.off("ready", handleReady);
      client?.off("presenceUpdate", handlePresenceUpdate);
    }
  }, [client, handlePresenceUpdate, handleReady]);

  useEffect(() => {
    if (!cookie.get("token")! && !["/login", "/register"].includes(pathname)) window.location.href = "/login";
    else if (!connected.current && !["/login", "/register"].includes(pathname)) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, client]);

  if ((!connected.current || !ready || clientError) && pathname !== "/login" && pathname !== "/register") {
    return <LoadingScreen />;
  }

  if ((!verified) && pathname !== "/login" && pathname !== "/register") {
    return (
      <ClientControllerContext.Provider value={{ client: client }}>
        <EmailVerifcation />
      </ClientControllerContext.Provider>
    )
  }

  return (
    <ClientControllerContext.Provider value={{ client: client }}>
      {children}
    </ClientControllerContext.Provider>
  )
}