import { Room, Space } from "@strafechat/strafe.js";
import { VoiceHeader } from "./voice/VoiceHeader";
import { useTranslation  } from "react-i18next";

export default function TextRoom(props: { space: Space, room: Room, hidden: boolean }) {
    const members = props.space.members;
    const room = props.room;
    const { t } = useTranslation();

   return (
      <>
          <VoiceHeader type="server" name={`${room?.name}`} />
    </>
   )
}