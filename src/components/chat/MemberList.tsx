import { formatStatusText } from "@/helpers/formatter";
import { useClient } from "@/hooks"

export default function MemberList() {

    const { client } = useClient();

    return (
        <div className="memberlist">
            <label className="role">Founder - 1</label>
            <ul className="members">
                <li className="member">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <div className="relative">
                        <img draggable={false} src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${client?.user?.id}/${client?.user?.avatar}`} alt="" className="avatar" />
                        <div className={`avatar-status ${client?.user?.presence.status}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="username">{client?.user?.username}</span>
                        <span className="status">{formatStatusText(client?.user?.presence!)}</span>
                    </div>
                </li>
                <li className="member">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <div className="relative">
                        <img draggable={false} src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${client?.user?.id}/${client?.user?.avatar}`} alt="" className="avatar" />
                        <div className={`avatar-status ${client?.user?.presence.status}`} />
                    </div>
                    <div className="flex flex-col">
                        <span className="username">{client?.user?.username}</span>
                        <span className="status">{formatStatusText(client?.user?.presence!)}</span>
                    </div>
                </li>
            </ul>
        </div>
    )
}