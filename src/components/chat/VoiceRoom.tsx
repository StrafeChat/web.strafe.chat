"use client";
import { Room, Space } from "@strafechat/strafe.js";
import { VoiceHeader } from "./voice/VoiceHeader";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";

export default function VoiceRoom(props: {
  space: Space;
  room: Room;
  hidden: boolean;
}) {
  const [token, setToken] = useState("");
  const members = props.space.members;
  const room = props.room;
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API}/portal/rooms/${room.id}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": localStorage.getItem("token")!,
            },
          }
        );
        const data = await res.json();
        setToken(data.token);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  if (token === "") {
    return (
      <>
        <VoiceHeader type="server" name={`${room?.name}`} />
        <h1>Loading..</h1>
      </>
    );
  }

  return (
    <>
      <VoiceHeader type="server" name={`${room?.name}`} />
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        data-lk-theme="default"
        style={{ background: "black" }}
      >
        <StrafeVoiceCall />
        <RoomAudioRenderer />
        <ControlBar variation="minimal" saveUserChoices={true} />
      </LiveKitRoom>
    </>
  );
}

function StrafeVoiceCall() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  return (
    <GridLayout
      tracks={tracks}
      style={{ height: "85%" }}
    >
      <ParticipantTile />
    </GridLayout>
  );
}