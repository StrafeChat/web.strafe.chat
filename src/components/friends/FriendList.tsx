import { useEffect, useState } from 'react';
import { useClient } from '@/hooks';
import { User } from '@strafechat/strafe.js';

export function FriendList() {
  const { client } = useClient();

  const [friends, setFriends] = useState<(User | null)[]>([]);

  useEffect(() => {
    if (!client) return;

    const init = async () => {
      const promises = client.user!.friends.map(id => client.users.fetch(id));
      setFriends((await Promise.allSettled(promises)).map(p => {
        if (p.status === "rejected") return null;
        return p.value;
      }));
    }

    if (client.ready) init();

    client.on("ready", init);

    return () => {
      client.off("ready", init);
    }
  }, [client]);

  return (
    <div>
      <h1 style={{ textAlign: "center" }}>Friends</h1>
      <p style={{ textAlign: "center" }}>Online: </p>
      <div>
        {friends.filter(f => f?.presence.online).map((friend, i) => (
          <div key={friend?.id || i}>
            {friend ? friend.username : "Error loading username"}
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center" }}>Offline: </p>
      <div>
        {friends.filter(f => !f?.presence.online).map((friend, i) => (
          <div key={friend?.id || i}>
            {friend ? friend.username : "Error loading username"}
          </div>
        ))}
      </div>
    </div>
  )
}