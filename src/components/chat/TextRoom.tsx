import { Room, Space } from "@strafechat/strafe.js";
import { useTranslation } from "react-i18next";
import MemberList from "./MemberList";
import ChatBody from "./text/ChatBody";
import { ChatHeader } from "./text/ChatHeader";
import { ChatInput } from "./text/ChatInput";

export default function TextRoom(props: { space: Space, room: Room, hidden: boolean }) {
  const members = props.space.members;
  const room = props.room;
  const { t } = useTranslation();

  return (
    <>
      <ChatHeader type="server" name={`${room?.name}`} />
      <div className="flex w-full h-full overflow-y-auto">
        <div className="flex flex-col w-full h-full overflow-y-auto">
          <ChatBody room={room} />
          <ChatInput placeholder={t("space.room.message_placeholder").replace(`{channel_name}`, `${room?.name}`)} room={room} />
        </div>
        <MemberList hidden={props.hidden} members={members} space={props.space} />
      </div>
    </>
  )
}