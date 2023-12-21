import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import cookie from "js-cookie";
import LoadingScreen from "@/components/LoadingScreen";
import { Relationship, useAuth } from "@/context/AuthContext";
import OpCodes from "../constants/OpCodes";
import { useRoom } from "@/context/RoomContext";
import { cacheMessages, clearCache, getCachedMessages } from "@/scripts/Caching";

export default function AuthService({ children }: { children: JSX.Element }) {
  const pathname = usePathname();
  const [clientError] = useState(false);

  const { user, connect, ws, setUser, setRelationships } = useAuth();
  const [wsInterval, setWsInterval] = useState<NodeJS.Timeout | null>(null);
  const { setPMs } = useRoom();

  const handleWsOpen = () => {
    console.log("WebSocket opened!");
    clearCache();
  };

  const handleMessageCreate = async (data: any) => {
    const messages = await getCachedMessages(data.room_id);
    if (messages) cacheMessages(data.room_id, [...messages, data]);
  }

  const handleMessageUpdate = async (data: any) => {
    const messages = await getCachedMessages(data.room_id);
    if (messages)
      cacheMessages(
        data.room_id,
        messages.map((message) => (message.id == data.id ? data : message))
      );
  }

  const handleMessageDelete = async (data: any) => {
    const messages = await getCachedMessages(data.room_id);
    if (messages)
      cacheMessages(
        data.room_id,
        messages.filter((message) => message.id != data.message_id)
      );
  }

  const handleUserUpdate = async (data: any) => {
    setRelationships((prev) => {
      return prev.map((relationship) => {
        if (relationship.sender_id == data.id) {
          return { ...relationship, sender: { ...data } };
        } else if (relationship.receiver_id == data.id) {
          return { ...relationship, receiver: { ...data } };
        } else return relationship;
      });
    });

    setPMs((prev) => {
      return prev.map((pm) => {
        return {
          ...pm,
          recipients:
            pm.recipients?.map((recipient) => {
              if (recipient.id == data.id) {
                return data;
              } else {
                return recipient;
              }
            }) ?? null,
        };
      });
    });
  }

  const handleWsMessage = (evt: MessageEvent) => {
    const { op, data, event } = JSON.parse(evt.data);
    switch (op) {
      case OpCodes.HELLO:
        setWsInterval(setInterval(() => {
          if (ws?.current?.OPEN) {
            ws?.current?.send(
              JSON.stringify({
                op: OpCodes.HEARTBEAT,
                data: null,
              })
            );
          }
        }, data.heartbeat_interval));
        ws?.current?.send(JSON.stringify({ op: OpCodes.IDENTIFY, data: { token: cookie.get("token") } }));
        break;
      case OpCodes.DISPATCH:
        switch (event) {
          case "READY":
            setUser(data);
            fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/relationships`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: cookie.get("token")!,
              },
            }).then(async (res) => {
              const data = await res.json();

              if (res.ok) setRelationships(data.relationships);
            });

            fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/rooms`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: cookie.get("token")!,
              },
            }).then(async (res) => {
              const data = await res.json();

              if (res.ok) setPMs([...data.rooms]);
            });
            break;
          case "MESSAGE_CREATE":
            return handleMessageCreate(data);
          case "MESSAGE_UPDATE":
            return handleMessageUpdate(data);
          case "MESSAGE_DELETE":
            return handleMessageDelete(data);
          case "USER_UPDATE":
            return handleUserUpdate(data);
        };
        break;
      case OpCodes.RELATIONSHIP_UPDATE:
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
      case OpCodes.INVALID_SESSION:
        window.location.href = "/login";
        break;
      case OpCodes.PRESENCE_UPDATE:
        setRelationships((prev) => {
          const updatedRelationships = prev.map((relationship) => {
            if (
              relationship.receiver_id === data.user_id ||
              relationship.sender_id === data.user_id
            ) {
              const updatedUser =
                data.user_id === relationship.receiver_id
                  ? {
                    ...relationship.receiver,
                    presence: { ...data, user_id: undefined },
                  }
                  : {
                    ...relationship.sender,
                    presence: { ...data, user_id: undefined },
                  };

              return {
                ...relationship,
                receiver_id: relationship.receiver_id,
                sender_id: relationship.sender_id,
                receiver:
                  data.user_id == relationship.receiver_id
                    ? updatedUser
                    : relationship.receiver,
                sender:
                  data.user_id == relationship.sender_id
                    ? updatedUser
                    : relationship.sender,
              };
            }
            return relationship;
          });

          return updatedRelationships;
        });

        setPMs((prev) => {
          const updatedPMs = prev.map((pm) => {
            const recipient = pm.recipients?.find(
              (recipient) => recipient.id == data.user_id
            );

            if (recipient) {
              const updatedUser = {
                ...recipient,
                presence: { ...data, user_id: undefined },
              };

              const updatedRecipients = pm.recipients!.map((r) =>
                r.id === data.user_id ? updatedUser : r
              );

              return {
                ...pm,
                recipients: updatedRecipients,
              };
            }

            return pm;
          });

          return updatedPMs;
        });
        break;
    }
  }

  const handleWsError = (event: Event) => {
    console.log(event);
  }

  const handleWsClose = (event: CloseEvent) => {
    if (wsInterval) clearInterval(wsInterval);
    const websocket = new WebSocket(process.env.NEXT_PUBLIC_WS!);
    connect(websocket);
    websocket.addEventListener("open", handleWsOpen);
    websocket.addEventListener("message", handleWsMessage);
    websocket.addEventListener("error", handleWsError);
    websocket.addEventListener("close", handleWsClose);
  };

  useEffect(() => {
    if (["/login", "/register"].includes(pathname)) return;
    if (!ws?.current) {
      const websocket = new WebSocket(process.env.NEXT_PUBLIC_WS!);
      connect(websocket);
      websocket.addEventListener("open", handleWsOpen);
      websocket.addEventListener("message", handleWsMessage);
      websocket.addEventListener("error", handleWsError);
      websocket.addEventListener("close", handleWsClose);
      document.addEventListener("contextmenu", (event) => event.preventDefault());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if ((!user.id || clientError) && pathname !== "/login" && pathname !== "/register") {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
