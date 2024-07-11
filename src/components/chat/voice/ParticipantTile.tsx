import { ParticipantTileProps } from "@/types";
import { WaveformVisualisation } from "./WaveformVisualisation";
import { useEffect, useState, createRef } from "react";
import { Formatting } from "@/helpers/formatter";

export function ParticipantTile({
  user,
  isLocal,
  audioTrack,
}: ParticipantTileProps) {
  //const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const audioRef = createRef<HTMLAudioElement>();

  useEffect(() => {
    if (!audioTrack) return;
    if (!!isLocal) return;
    const stream = new MediaStream([audioTrack]);
    if (!stream) return;
    audioRef.current!.srcObject = stream;
  }, [audioTrack]);

  return (
    <div
      style={{
        position: "relative",
        height: "5rem",
        width: "5rem",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div className="video">
        {videoTrack ? null : !user ? null : ( // TODO: // TODO: default avatar/placeholder
          <img
            src={`${Formatting.formatAvatar(user.userId, user.user.avatar)}`}
            style={{ height: "100%", aspectRatio: "1/1", borderRadius: "50%" }}
          ></img>
        )}
      </div>
      {/* <h3>{user?.user.display_name ?? "Strife"}</h3> */}
      <audio ref={audioRef} autoPlay={true}></audio>
      {!!audioTrack ? (
        <WaveformVisualisation
          track={audioTrack}
          style={{}}
          minTreshold={128}
        />
      ) : null}
    </div>
  );
}