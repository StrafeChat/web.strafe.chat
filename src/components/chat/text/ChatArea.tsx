import { Room, Space } from "@strafechat/strafe.js";
import { useTranslation } from "react-i18next";
import ChatBody from "./ChatBody";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";

export default function ChatArea(props: { room: Room, }) {
  const room = props.room;
  const { t } = useTranslation();

  return (
    <>
      <div className="chatarea flex w-full h-full overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col h-full w-full overflow-y-auto overflow-x-hidden">
          <ChatBody room={room} />
          <ChatInput placeholder={t("space.room.message_placeholder").replace(`{channel_name}`, `${room?.name}`)} room={room} />
        </div>
      </div>
    </>
  )
}