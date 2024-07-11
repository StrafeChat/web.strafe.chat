import { useEffect, useState } from 'react';
import { useClient } from '@/hooks';
import { User } from '@strafechat/strafe.js';
import { Formatting } from '@/helpers/formatter';

export function AllFriends() {
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
    <div className="p-[2rem] flex flex-col">
      <span className="uppercase font-bold text-gray-500 pb-[7px]">
        All Friends - {friends.length}
      </span>
      {friends
        .map((friend, _i) => (
          <div className="w-full p-2 hover:rounded-[0.25rem] hover:bg-secondary flex justify-between cursor-pointer">
            <div className="flex gap-2.5 w-fit items-center">
              <img
                className="rounded-full"
                src={`${Formatting.formatAvatar(friend?.id, friend?.avatar)}`}
                width={40}
                height={40}
                alt="profile"
              />
              <span className="text-white mt-[-4px]">
                <span className="text-sm font-bold">{friend?.displayName}</span>
                <span className="block text-sm">
                  {Formatting.formatStatusText(friend?.presence!)}
                </span>
              </span>
            </div>{" "}
            <div className="flex w-fit items-center"></div>
          </div>
        ))}
    </div>
  </div>
  )
}