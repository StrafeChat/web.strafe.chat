import { IRoom, ISpace } from "@strafechat/strafe.js";
import MemberList from "./MemberList";
import ChatBody from "./text/ChatBody";
import { ChatHeader } from "./text/ChatHeader";
import { useTranslation  } from "react-i18next";
import { ChatInput } from "./text/ChatInput";

export default function TextRoom(props: { space: ISpace, room: IRoom, hidden: boolean }) {
    const members = props.space.members;
    const room = props.room;
    const { t } = useTranslation();

   return (
      <>
      <ChatHeader type="server" name={`${room?.name}`} />
      <div className="flex flex-grow">
        <div className="flex flex-col flex-grow">
          <ChatBody room={room} />
          <ChatInput placeholder={t("space.room.message_placeholder").replace(`{channel_name}`, `${room?.name}`)} />
        </div>
        <MemberList hidden={props.hidden} members={members} space={props.space} />
      </div>
    </>
   )
}