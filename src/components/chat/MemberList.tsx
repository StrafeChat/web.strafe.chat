import { formatStatusText } from "@/helpers/formatter";
import { useClient } from "@/hooks";
import { Member, Space, User } from "@strafechat/strafe.js";
import { Popover, PopoverTrigger } from "../ui/popover";
import ProfilePopup from "../popup/ProfilePopup";
import { useState } from "react";
let isMobile = typeof window !== "undefined" && window.innerWidth < 768;
window.addEventListener("resize", () => {
    isMobile = typeof window !== "undefined" && window.innerWidth < 768;
});
export default function MemberList(props: { hidden: boolean, members: any, space: Space }) {
    let [hidden, setHidden] = useState(props.hidden || false);
    let members = props.members;

    if (typeof window !== "undefined") {
        window.addEventListener("hide-sidebar", () => {
            setHidden(!hidden);
        });
    }
    const { client } = useClient();
    return (
        <div className="memberlist"
            style={{ ...(isMobile && hidden ? { display: "none" } : {}) }}
        >
    <ul className="members">
{
   members?.toArray().filter((member: any) => member.user.presence.online == true && member.user.presence.status !== "offline").length > 0 && 
   <>
        <label className="role">Online - {members?.toArray().filter((member: any) => member.user.presence.online == true && member.user.presence.status !== "offline").length}</label>
                {members?.toArray()
                 .filter((member: any) => member.user.presence.online == true && member.user.presence.status !== "offline")
                 .sort((a: any, b: any) => a.user.global_name ?? a.user.username.localeCompare(b.user.global_name ?? b.user.username))
                 .map((member: any) => (
                    <ProfilePopup user={member?.user as unknown as User}>
                    <li key={member.id} className="member online">
                    <div className="relative">
                        <img draggable={false} src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${member?.user.id}/${member?.user.avatar}`} alt="Avatar" className="avatar" />
                        <div className={`avatar-status ${member?.user.presence!.status}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="username">{member?.user.global_name ?? member?.user.username}</span>
                        <span className="status">{formatStatusText(member?.user.presence!)}</span>
                    </div>
                 </li>
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
                    <ProfilePopup user={member?.user}>
                    <li key={member.userId} className="member offline">
                    <div className="relative">
                        <img draggable={false} src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${member?.user.id}/${member?.user.avatar}`} alt="Avatar" className="avatar" />
                    </div>
                    <div className="flex flex-col">
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