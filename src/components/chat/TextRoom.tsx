import { Room, Space } from "@strafechat/strafe.js";
import { useTranslation } from "react-i18next";
import MemberList from "./MemberList";
import ChatBody from "./text/ChatBody";
import { ChatHeader } from "./text/ChatHeader";
import { ChatInput } from "./text/ChatInput";
import ChatArea from "./text/ChatArea";

export default function TextRoom(props: { space: Space, room: Room, hidden: boolean }) {
  const members = props.space.members;
  const room = props.room;
  const { t } = useTranslation();

  return (
    <>
      <ChatHeader type="server" name={`${room?.name}`} />
      <div className="flex w-full h-full overflow-y-auto overflow-x-hidden">
           <ChatArea room={room} />
        <MemberList hidden={props.hidden} members={members} space={props.space} />
      </div>
    </>
  )
}