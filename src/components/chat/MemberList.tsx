import { formatStatusText } from "@/helpers/formatter";
import { useClient } from "@/hooks";
import { useState } from "react";
let isMobile = typeof window !== "undefined" && window.innerWidth < 768;
window.addEventListener("resize", () => {
    isMobile = typeof window !== "undefined" && window.innerWidth < 768;
});
export default function MemberList(props: { hidden: boolean }) {
    let [hidden, setHidden] = useState(props.hidden || false);
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
            <label className="role">Founder - 1</label>
            <ul className="members">
                <li className="member">
                    <div className="relative">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img draggable={false} src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${client?.user?.id}/${client?.user?.avatar}`} alt="" className="avatar" />
                        <div className={`avatar-status ${client?.user?.presence.status}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="username">{client?.user?.username}</span>
                        <span className="status">{formatStatusText(client?.user?.presence!)}</span>
                    </div>
                </li>
                <li className="member">
                    <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img draggable={false} src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${client?.user?.id}/${client?.user?.avatar}`} alt="" className="avatar" />
                        <div className={`avatar-status ${client?.user?.presence.status}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="username">{client?.user?.username}</span>
                        <span className="status">{formatStatusText(client?.user?.presence!)}</span>
                    </div>
                </li>
            </ul>
            <label className="role">Offline - 1</label>
             <ul className="members">
              <li className="member offline">
                    <div className="relative">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img draggable={false} src={`https://cdn.discordapp.com/attachments/1135670060678123560/1189859177393291284/trumpshutdownraises.png?ex=659fb1b6&is=658d3cb6&hm=bef32dbb441eb1e95258d14d3bc107a5b66976fc10ec6001d96d2a90eecbac32&g`} alt="Avatar" className="avatar" />
                    </div>
                    <div className="flex flex-col">
                        <span className="username">Donald J. Trump</span>
                    </div>
                </li>
            </ul>
        </div>
    )
}