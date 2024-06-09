"use client";
import EmailVerifcation from "@/components/auth/EmailVerifcation";
import { LoadingScreen } from "@/components/shared";
import { useToast } from "@/components/ui/use-toast";
import { Client } from "@strafechat/strafe.js";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForceUpdate } from "../../hooks";

export const ClientControllerContext = createContext<{ client: Client | null }>({
  client: null,
});

export default function ClientController({ children }: { children: JSX.Element }) {

  const pathname = usePathname();
  const { i18n } = useTranslation();
  const [client, setClient] = useState<Client | null>(null);
  const [ready, setReady] = useState(false);
  const [clientError, setClientError] = useState(false);
  const connected = useRef(false);

  const forceUpdate = useForceUpdate();

  const { toast } = useToast();

  const handleReady = useCallback(() => {
    setReady(true);
    setClientError(false);
    i18n.changeLanguage(client?.user?.locale.replace("-", "_"))
  }, [i18n, client])

  const handlePresenceUpdate = useCallback((data: any) => {
    if (client!.user && data.user.id == client!.user.id) client!.user.presence = data.presence;
    forceUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const handleMessageCreate = useCallback((data: any) => {
    forceUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const handleMessageDelete = useCallback((data: any) => {
    // forceUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const init = async () => {

    const clt = new Client({
      config: {
        equinox: process.env.NEXT_PUBLIC_API
      }
    });

    setClient(clt);

    clt.login(localStorage.getItem("token")!);

    clt.on("error", (err) => {
      if (err.code == 4004) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else {
        setClientError(true);
        // toast({
        //   title: "Something went wrong!",
        //   description: err.message,
        //   duration: 1000,
        //   className: "bg-destructive"
        // });
        console.error("ERROR:", err.message)
      }
    });

    connected.current = true;
  }

  useEffect(() => {
    client?.on("ready", handleReady);
    client?.on("presenceUpdate", handlePresenceUpdate);
    client?.on("messageCreate", handleMessageCreate);
    client?.on("messageDelete", handleMessageDelete);
    client?.on("messageUpdate", handleMessageCreate);

    return () => {
      client?.off("ready", handleReady);
      client?.off("presenceUpdate", handlePresenceUpdate);
      client?.off("messageCreate", handleMessageCreate);
      client?.off("messageDelete", handleMessageDelete);
      client?.off("messageUpdate", handleMessageCreate);
    }
  }, [client, handlePresenceUpdate, handleReady]);

  useEffect(() => {
    if (!localStorage.getItem("token")! && !["/login", "/register"].includes(pathname!)) window.location.href = "/login";
    else if (!connected.current && !["/login", "/register"].includes(pathname!)) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, client]);

  if ((!connected.current || !ready || clientError) && pathname !== "/login" && pathname !== "/register") {
    return <LoadingScreen />;
  }

  if ((!client?.user?.verified) && pathname !== "/login" && pathname !== "/register") {
    return (
      <ClientControllerContext.Provider value={{ client }}>
        <EmailVerifcation />
      </ClientControllerContext.Provider>
    )
  }

  return (
    <ClientControllerContext.Provider value={{ client }}>
      {children}
    </ClientControllerContext.Provider>
  )
}