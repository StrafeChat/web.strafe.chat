import { Button } from "@/components/ui/button";
import { useVoice } from "@/hooks";
import { FaPhoneSlash, FaMicrophoneSlash, FaMicrophone } from "react-icons/fa6";

export function RoomControls() {
  const { isVoiceMuted, toggleVoiceMute, disconnect } = useVoice();

  // TODO: make buttons round
  return (
    <div style={{
      display: "flex",
      flexDirection: "row",
    }}>
      <Button>1</Button>
      <Button>2</Button>
      <Button>3</Button>
      <Button>4</Button>
      <Button variant={"secondary"} onClick={() => {
        toggleVoiceMute();
      }}>
        {isVoiceMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
      </Button>
      <Button variant={"destructive"} onClick={() => {
        disconnect();
      }}><FaPhoneSlash /></Button>
    </div>
  )
}