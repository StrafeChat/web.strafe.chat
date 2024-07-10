import { useClient } from "@/hooks"
import { useEffect, useState } from "react"
import { Button } from "../ui/button";
import { IFriendRequest, IPartialFriendRequest, FriendRequest, User } from "@strafechat/strafe.js";

interface ExtendedFriendRequest {
  user?: User;
  request: FriendRequest;
}

export function FriendRequestList({}) {
  const { client } = useClient();

  const [incoming, setIncoming] = useState<ExtendedFriendRequest[]>([]);
  const [pending, setPending] = useState<ExtendedFriendRequest[]>([]);

  useEffect(() => {
    if (!client) return;

    const init = () => {
      client.friendRequests.fetchAll().then(async (requests) => {
        const incoming = requests.filter(r => r.recipientId === client.user!.id);
        const pending = requests.filter(r => r.senderId === client.user!.id);

        var promises = await Promise.allSettled(incoming.map(r => {
          return client.users.fetch(r.senderId);
        }));
        const extendedIncoming = incoming.map((r, i) => {
          if (promises[i].status === "rejected") return { request: r,  user: null };
          return { request: r, user: promises[i].value }
        });

        promises = await Promise.allSettled(pending.map(r => {
          return client.users.fetch(r.recipientId);
        }));
        const extendedPending = pending.map((r, i) => {
          if (promises[i].status === "rejected") return { request: r,  user: null };
          return { request: r, user: promises[i].value }
        });

        setIncoming(extendedIncoming as ExtendedFriendRequest[]);
        setPending(extendedPending as ExtendedFriendRequest[]);
      });
    }
    const createRequest = async (data: IFriendRequest) => {
      const request = client.friendRequests.get(data.id)!;
      if (data.recipient_id === client.user!.id) {
        const extended = { request, user: await client.users.fetch(request.senderId)! } as ExtendedFriendRequest;
        setIncoming((prev) => [...prev, extended]);
      } else if (data.sender_id === client.user!.id) {request.senderId
        const extended = { request, user: await client.users.fetch(request.recipientId)! } as ExtendedFriendRequest;
        setPending((prev) => [...prev, extended]);
      }
    }
    const removeRequest = (data: IPartialFriendRequest) => {
      const id = data.id;
      setIncoming((prev) => prev.filter(r => r.request.id !== id));
      setPending((prev) => prev.filter(r => r.request.id !== id));
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
            <div key={request.request.id}>
              <p>{request.user?.username || "Unkown user"}</p>
              <Button variant={"default"} onClick={() => request.request.accept()}>Accept</Button>
              <Button variant={"destructive"} onClick={() => request.request.decline()}>Decline</Button>
            </div>
          )
        })}
      </div>

      <div>
        <h1>Outgoing Friend Requests</h1>
        {pending.map((request) => {
          return (
            <div key={request.request.id}>
              <p>{request.user?.displayName || "Unknown user"}</p>
              <Button variant={"destructive"} onClick={() => request.request.cancel()}>Cancel</Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}