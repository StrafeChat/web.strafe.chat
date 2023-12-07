import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import cookie from "js-cookie";
import { useAuth } from "@/context/AuthContext";
import { RoomProvider } from "@/context/RoomContext";

export default function AuthService({ children }: { children: JSX.Element }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setUser } = useAuth();

  const wsRef = useRef<WebSocket | null>(null);
  const connectedRef = useRef(false);

  const handleWsOpen = (event: Event) => {
    console.log("Connected");
    connectedRef.current = true;
  };

  const handleWsMessage = useCallback(
    (evt: MessageEvent<any>) => {
      const { op, data, event } = JSON.parse(evt.data);
      switch (op) {
        case 0:
          setInterval(() => {
            wsRef.current?.send(
              JSON.stringify({
                op: 1,
                data: null,
              })
            );
          }, data.heartbeat_interval);
          wsRef.current?.send(
            JSON.stringify({ op: 2, data: { token: cookie.get("token") } })
          );
          break;
        case 3:
          switch (event) {
            case "READY":
              setUser(data);
              break;
          }
          break;
      }
    },
    [setUser]
  );

  const handleWsClose = useCallback(
    (event: CloseEvent) => {
      connectedRef.current = false;
      switch (event.code) {
        case 4004:
          router.push("/login");
          break;
        default:
          console.log(event);
          wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WS!)
          break;
      }
    },
    [router]
  );

  const handleWsError = (event: Event) => {
    connectedRef.current = false;
  };

  useEffect(() => {
    if (pathname == "/register" || pathname == "/login") return;
    const token = cookie.get("token");
    if (!token) return router.push("/login");
    if (!connectedRef.current) {
      wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WS!);
      wsRef.current.addEventListener("open", handleWsOpen);
      wsRef.current.addEventListener("message", handleWsMessage);
      wsRef.current.addEventListener("close", handleWsClose);
      wsRef.current.addEventListener("error", handleWsError);
      document.addEventListener("contextmenu", (event) =>
        event.preventDefault()
      );
    }

    return () => {
      wsRef.current?.removeEventListener("open", handleWsOpen);
      wsRef.current?.removeEventListener("message", handleWsMessage);
      wsRef.current?.removeEventListener("close", handleWsClose);
      wsRef.current?.removeEventListener("error", handleWsError);
      document.removeEventListener("contextmenu", (event) =>
        event.preventDefault()
      );
    };
  }, [connectedRef, handleWsClose, handleWsMessage, pathname, router, wsRef]);

  return <RoomProvider>{children}</RoomProvider>;
}
