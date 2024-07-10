import { useClient } from "@/hooks"
import { useEffect, useState } from "react"
import { Button } from "../ui/button";
import { IFriendRequest, IPartialFriendRequest, FriendRequest } from "@strafechat/strafe.js";

export function FriendRequestList({}) {
  const { client } = useClient();

  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [pending, setPending] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (!client) return;

    const init = () => {
      client.friendRequests.fetchAll().then((requests) => {
        const incoming = requests.filter(r => r.recipientId === client.user!.id);
        const pending = requests.filter(r => r.senderId === client.user!.id);

        setIncoming(incoming);
        setPending(pending);
      });
    }
    const createRequest = (data: IFriendRequest) => {
      const request = client.friendRequests.get(data.id)!;
      if (data.recipient_id === client.user!.id) {
        setIncoming((prev) => [...prev, request]);
      } else if (data.sender_id === client.user!.id) {
        setPending((prev) => [...prev, request]);
      }
    }
    const removeRequest = (data: IPartialFriendRequest) => {
      const id = data.id;
      setIncoming((prev) => prev.filter(r => r.id !== id));
      setPending((prev) => prev.filter(r => r.id !== id));
    }

    if (client.ready) init();

    client.on("ready", init);
    client.on("friendRequestCreate", createRequest);
    client.on("friendRequestAccept", removeRequest);
    client.on("friendRequestDecline", removeRequest);
    client.on("friendRequestDelete", removeRequest)

    return () => {
      client.off("ready", init);
      client.off("friendRequestCreate", createRequest);
      client.off("friendRequestAccept", removeRequest);
      client.off("friendRequestDecline", removeRequest);
      client.off("friendRequestDelete", removeRequest)
    }
  }, [client]);

  return (
    <div style = {{
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      alignItems: "center",
    }}>
      <div>
        <h1>Incoming Friend Requests</h1>
        {incoming.map((request) => {
          return (
            <div key={request.id}>
              <p>{request.senderId}</p>
              <Button variant={"default"} onClick={() => request.accept()}>Accept</Button>
              <Button variant={"destructive"} onClick={() => request.decline()}>Decline</Button>
            </div>
          )
        })}
      </div>

      <div>
        <h1>Outgoing Friend Requests</h1>
        {pending.map((request) => {
          return (
            <div key={request.id}>
              <p>{request.recipientId}</p>
              <Button variant={"destructive"} onClick={() => request.cancel()}>Cancel</Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}