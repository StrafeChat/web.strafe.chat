import { IRoom, ISpace } from "@strafechat/strafe.js";
import { VoiceHeader } from "./voice/VoiceHeader";
import { useTranslation  } from "react-i18next";

export default function TextRoom(props: { space: ISpace, room: IRoom, hidden: boolean }) {
    const members = props.space.members;
    const room = props.room;
    const { t } = useTranslation();
    console.log(room)

   return (
      <>
          <VoiceHeader type="server" name={`${room?.name}`} />
    </>
   )
}