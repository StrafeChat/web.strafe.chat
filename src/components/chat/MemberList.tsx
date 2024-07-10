import { Formatting } from "@/helpers/formatter";
import { Member, Space, User } from "@strafechat/strafe.js";
import { Popover, PopoverTrigger } from "../ui/popover";
import ProfilePopup from "../popup/ProfilePopup";
import { useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@radix-ui/react-context-menu";
export default function MemberList(props: { hidden: boolean, members: any, space: Space }) {
    let members = props.members;

    return (
        <div className="memberlist xl:w-full " 
        >
    <ul className="members">
{
   members?.toArray().filter((member: any) => member.user.presence.online == true && member.user.presence.status !== "offline").length > 0 && 
   <>
        <label className="role">Online - {members?.toArray().filter((member: any) => member.user.presence.online == true && member.user.presence.status !== "offline").length}</label>
                {members?.toArray()
                 .filter((member: any) => member.user.presence.online == true && member.user.presence.status !== "offline")
                 .sort((a: any, b: any) => a.user.display_name.localeCompare(b.user.display_name))
                 .map((member: any) => (
                    <ProfilePopup key={member.userId} user={member?.user} client>
                    {/* <ContextMenu>
                    <ContextMenuTrigger> */}
                    <li key={member.userId} className="member online">
                    <div className="flex flex-col">
                        <div className="relative">
                        <img draggable={false} src={`${Formatting.formatAvatar(member?.user.id, member?.user.avatar)}`} alt="Avatar" className="avatar" />
                        <div className={`avatar-status ${member?.user.presence!.status}`} />
                        </div>
                        <span className="username">{member?.user.global_name ?? member?.user.username}</span>
                        <span className="status">{Formatting.formatStatusText(member?.user.presence!)}</span>
                        </div>
                 </li>
                 {/* </ContextMenuTrigger>
                 <ContextMenuContent>
                  <ContextMenuItem className="flex gap-2 items-center"> Open Profile</ContextMenuItem>
                 </ContextMenuContent>
                 </ContextMenu> */}
                 </ProfilePopup>
                 ))
                }
    </>
}
{
   members?.toArray().filter((member: any) => member.user.presence.online == false || member.user.presence.status == "offline").length > 0 && 
    <>
        <label className="role">Offline - {members?.toArray().filter((member: any) => member.user.presence.online == false || member.user.presence.status == "offline").length}</label>
                {members?.toArray()
                 .filter((member: any) => member.user.presence.online == false || member.user.presence.status == "offline")
                 .sort((a: any, b: any) => a.user.display_name.localeCompare(b.user.display_name))
                 .map((member: any) => (
                    <ProfilePopup key={member.userId} user={member?.user} client>
                    <li key={member.userId} className="member offline">
                    <div className="flex flex-col">
                    <div className="relative">
                        <img draggable={false} src={`${Formatting.formatAvatar(member?.user.id, member?.user.avatar)}`} alt="Avatar" className="avatar" />
                    </div>
                        <span className="username">{member?.user.display_name}</span>
                    </div>
                    </li>
                </ProfilePopup>
                 ))
                }
          </>
        }
      </ul>
     </div>
    )
}