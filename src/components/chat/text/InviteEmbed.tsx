import { Client, Invite } from "@strafechat/strafe.js";

export function InviteEmbed(props: { invite: Invite, client: Client }) {
  const space = props.client.spaces.get(props.invite.space.id);
  const onlineCount = space?.members.toArray().filter((member) => member.user.presence.online).length
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
          <button className="mr-2 rounded-lg bg-green-700 px-4 py-2 text-sm">Join{space ? "ed" : ""}</button>
        </div>
    );
  }
  