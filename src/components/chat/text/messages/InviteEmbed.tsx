import { Client, Invite, ISpace, Room, Space } from "@strafechat/strafe.js";
import { useRouter } from "next/navigation";

export function InviteEmbed(props: { invite: Invite, client: Client }) {
  const router = useRouter();
  const space = props.client.spaces.get(props.invite.space.id);
  const onlineCount = space?.members.toArray().filter((member) => member.user.presence.online).length

  const handleAcceptInvite = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API}/invites/${props.invite.code

      }`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `${localStorage.getItem("token")!}`
        }
      });

      const resData = await response.json();

      const spaceData = resData.space;
      spaceData.rooms = resData.rooms;
      const members = resData.members;
      spaceData.client = props.client;
      const space = new Space(spaceData as ISpace);
      spaceData.rooms.forEach((roomData: any) => {
          roomData.client = props.client;
          const room = new Room(roomData);
          space.rooms.set(room.id, room);
      });
 
         members.forEach((membersData: any) => {
             membersData.client = props.client;
             const member = membersData;
            space.members.set(member.id, member)    
          });

      props.client.spaces.set(space.id, space);

      if (response.ok) {
        props.client.spaces.set(space.id, space)
        router.push(`/spaces/${props.invite?.spaceId}/rooms/${props.invite?.roomId}`);
      } else {
        if (response.status == 409) {
          router.push(`/spaces/${props.invite?.spaceId}/rooms/${props.invite?.roomId}`);
        } else console.error('Failed to accept invite:', response.statusText);
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
    }
  };

    return (
      <div className="grid w-96 grid-cols-[min-content_1fr_max-content] items-center gap-4 rounded-lg invite p-2">
          <div className="size-14 rounded-lg bg-gray-900 bg-opacity-30 flex items-center justify-center">
            <p className="text-white">{props.invite.space.name_acronym}</p>
          </div>
          <div className="overflow-hidden">
            <h3 className="font-semibold">{props.invite.space.name}</h3>
            {/* <p className="truncate text-xs text-muted-foreground">The super mega fun place to be, like it is the best i swear</p> */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-green-500" />
                <p>{onlineCount} Online</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-gray-900 bg-opacity-30" />
                <p>{props.invite.memberCount} Members</p>
              </div>
            </div>
          </div>
          <button onClick={handleAcceptInvite} className="mr-2 rounded-lg bg-green-700 px-4 py-2 text-sm">Join{space ? "ed" : ""}</button>
        </div>
    );
  }
  