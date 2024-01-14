"use client";
import EmailVerifcation from "@/components/app/EmailVerifcation";
import LoadingScreen from "@/components/app/Loading";
import { useToast } from "@/components/ui/use-toast";
import { Client } from "@strafechat/strafe.js";
import cookie from "js-cookie";
import { usePathname } from "next/navigation";
import { Dispatch, SetStateAction, createContext, useContext, useEffect, useRef, useState } from 'react';

const ClientControllerContext = createContext<{ client: Client | null, setVerified: Dispatch<SetStateAction<boolean>> }>({
  client: null,
  setVerified: {} as Dispatch<SetStateAction<boolean>>,
});

export default function ClientController({ children }: { children: JSX.Element }) {

  const pathname = usePathname();

  const client = useRef<Client | null>(null);
  const [ready, setReady] = useState(false);
  const [clientError, setClientError] = useState(false);
  const [verified, setVerified] = useState(false);

  const { toast } = useToast();

  const init = () => {
    const clt = new Client({
      config: {
        equinox: "http://localhost:443/v1"
      }
    });
    clt.on("ready", (data) => {
      console.log("Websocket ready!");
      setReady(true);
      setClientError(false);
      setVerified(clt.user!.verified);
    });
    clt.login(cookie.get("token")!);
    clt.on("error", (err) => {
      if (err.code == 4004) {
        cookie.remove("token");
        window.location.href = "/login";
      } else setClientError(true);
      console.log(err);
      toast({ title: "Something went wrong.", description: err, className: "bg-destructive" });
    });
    client.current = clt;
    // setVerified(clt.user!.verified);
  }

  useEffect(() => {
    if (!cookie.get("token")! && !["/login", "/register"].includes(pathname)) window.location.href = "/login";
    else if (!client.current && !["/login", "/register"].includes(pathname)) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if ((!client || !ready || clientError) && pathname !== "/login" && pathname !== "/register") {
    return <LoadingScreen />;
  }

  if ((!verified) && pathname !== "/login" && pathname !== "/register") {
    return (
      <ClientControllerContext.Provider value={{ client: client.current, setVerified }}>
        <EmailVerifcation />
      </ClientControllerContext.Provider>
    )
  }

  return (
    <ClientControllerContext.Provider value={{ client: client.current, setVerified }}>
      {children}
    </ClientControllerContext.Provider>
  )
}

export const useClient = () => useContext(ClientControllerContext);