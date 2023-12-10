import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
import cookie from "js-cookie";
import LoadingScreen from "@/components/LoadingScreen";
import { Relationship, useAuth } from "@/context/AuthContext";
import { RoomProvider } from "@/context/RoomContext";

export default function AuthService({ children }: { children: JSX.Element }) {
  const pathname = usePathname();
  const router = useRouter();
  const [clientError, setClientError] = useState(false);

  const { user, setUser, setRelationships } = useAuth();

  const wsRef = useRef<WebSocket | null>(null);
  const connectedRef = useRef(false);

  const handleWsOpen = useCallback(
    (_event: Event) => {
      console.log("Connected");
      setClientError(false);
      connectedRef.current = true;
      fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/relationships`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: cookie.get("token")!,
        },
      }).then(async (res) => {
        const data = await res.json();

        if (!res.ok) return console.log(data);

        setRelationships(data.relationships);
      });
    },
    [setRelationships]
  );

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
              setClientError(false);
              break;
          }
          break;
        case 4:
          switch (data.status) {
            case "accepted":
              setRelationships((prev) => {
                const updatedRelationships = prev.map((relationship) => {
                  if (
                    relationship.receiver_id === data.receiver_id &&
                    relationship.sender_id === data.sender_id
                  ) {
                    return {
                      ...relationship,
                      status: "accepted",
                    } as Relationship;
                  }
                  return relationship;
                });

                return updatedRelationships;
              });
              break;
            case "rejected":
            case "deleted":
              setRelationships((prev) =>
                prev.filter((relationship) => {
                  console.log(relationship.receiver_id, data.receiver_id);
                  return (
                    relationship.receiver_id != data.receiver_id &&
                    relationship.sender_id != data.sender_id
                  );
                })
              );
              break;
            case "pending":
              setRelationships((prev) => [...prev, data]);
              break;
          }
          break;
      }
    },
    [setRelationships, setUser]
  );

  const handleWsClose = useCallback(
    (event: CloseEvent) => {
      connectedRef.current = false;
      setClientError(true);
      switch (event.code) {
        case 4004:
          router.push("/login");
          break;
        default:
          if (wsRef.current?.CLOSED) {
            wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WS!);
            wsRef.current.addEventListener("open", handleWsOpen);
            wsRef.current.addEventListener("message", handleWsMessage);
            wsRef.current.addEventListener("close", handleWsClose);
            wsRef.current.addEventListener("error", handleWsError);
            document.addEventListener("contextmenu", (event) =>
              event.preventDefault()
            );
          }
          break;
      }
    },
    [handleWsMessage, handleWsOpen, router]
  );

  const handleWsError = (_event: Event) => {
    connectedRef.current = false;
    setClientError(true);
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
  }, [
    connectedRef,
    handleWsClose,
    handleWsMessage,
    handleWsOpen,
    pathname,
    router,
    setRelationships,
    wsRef,
  ]);

  if (!user.id && pathname != "/login" && pathname != "/register")
    return <LoadingScreen />;
  if (clientError && pathname != "/login" && pathname != "/register") 
    return <LoadingScreen />;
  return <RoomProvider>{children}</RoomProvider>;
}
