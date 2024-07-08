import React, { use, useEffect, useState } from "react";
import "@livekit/components-styles";
import { Track, TrackPublication, Participant } from "livekit-client";
import { VoiceHeader } from "./voice/VoiceHeader"; // Adjust path as per your project structure
import { Button } from "@/components/ui/button";

import { useClient, useVoice, useForceUpdate, useModal } from "@/hooks/";
import { RoomControls } from "./voice/RoomControls";
import { ParticipantTile } from "./voice/ParticipantTile";
import VoiceCallController from "./voice/VoiceCall";
import type { Space, Room } from "@strafechat/strafe.js";

export default function VoiceRoom(props: {
  space: Space;
  room: Room; 
  hidden: boolean;
}) {
  const { client } = useClient();
  const {
    connection,
    setConnection,
    setRoomInfo,
    disconnect,
    muteVoice,
  } = useVoice();
  const { openCallbackModal, openModal } = useModal();

  // const { t } = useTranslation(); translations

  const [tracks, setTracks] = useState<MediaStreamTrack[]>([]);

  const initiateConnection = () => {
    // TODO: close connection if channel switch
    if (props.room.id === connection?.room.name) return;
    if (props.room.id !== connection?.room.name && connection) {
      disconnect();
    }

    client!.voice.joinChannel(props.room.id).then((connection) => {
      setConnection(connection);
      setRoomInfo({ room: props.room, space: props.space });

      connection.on("connected", async () => {
        var device: ConstrainDOMString;

        try {
          device = await deviceChooser();
        } catch(e) {
          return muteVoice();
        }
        navigator.mediaDevices
          .getUserMedia({
            audio: {
              deviceId: device,
            },
            video: false,
          })
          .then((stream) => {
            setTracks(stream.getAudioTracks());
            connection.publishTracks(stream.getTracks());
          });
      });
    });
    console.log("connecting to room", props.room.id);

    return () => {
      if (connection) {
        console.log("disconnecting");
        connection.disconnect();
        setConnection(null);
      }
    };
  };

  const deviceChooser = (): Promise<ConstrainDOMString> => {
    return new Promise(async (res, rej) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return res("default");
      }

      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");

      const id = await openCallbackModal("choose-device", { devices }) as (ConstrainDOMString & "strafechat-cancel");
      s.getTracks().forEach(t => t.stop());
      if (id === "strafechat-cancel") return rej();

      return res(id); // TODO: fix this
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        devices = devices.filter(d => d.kind === "audioinput");

        console.log(devices, "opening");

        /*openCustomModal("DeviceChooser", (
          <DeviceChooser devices={devices} res={(device) => {
            closeModal("DeviceChooser");
            res(device);
          }}></DeviceChooser>
        ));*/
      }).catch(e => {
        console.warn(e);
        return "default";
      });
    });
  }

  useEffect(() => {
    console.log("tracks", tracks);
  }, [tracks]);

  if (!connection) {
    return (
      <>
        <VoiceHeader type="server" name={`${props.room?.name}`} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <h3>TODO: add room preview</h3>
          <Button onClick={initiateConnection}>Connect</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <VoiceHeader type="server" name={`${props.room?.name}`} />
      <VoiceCallController>
        <StrafeVoiceCall></StrafeVoiceCall>
      </VoiceCallController>
    </>
  );
}

interface UserTrackPublication extends TrackPublication {
  user: Participant;
}

function StrafeVoiceCall(props: {}) {
  const { connection, localParticipant, roomInfo, manager } = useVoice();

  const [localTrack, setLocalTrack] = useState<MediaStreamTrack | null>(null);
  const [tracks, setTracks] = useState<UserTrackPublication[]>([]);

  const [users, setUsers] = useState<Participant[]>([]);

  useEffect(() => {
    if (!connection) return;

    const userJoin = (user: Participant) => {
      console.log("user joined", user);
      setUsers((prev) => [...prev, user]);
    }
    const userLeave = (user: Participant) => {
      var idx = users.findIndex(u => u.identity === user.identity);
      if (idx === -1) {
        setUsers([...users]);
      } else {
        users.splice(idx, 1);
        setUsers([...users]);
      }

      var idx = tracks.findIndex(t => t.user.identity === user.identity);
      if (idx === -1) return setTracks([...tracks]);
      tracks.splice(idx, 1);
      setTracks([...tracks]);
    }
    const addTrack = ({ publication, participant }: { publication: TrackPublication, participant: Participant }) => {
      console.log("track added", publication);
      const t = publication as UserTrackPublication;
      t.user = participant;
      setTracks((prev) => [...prev, t]);
      if (!users.find(u => u.identity === participant.identity)) setUsers([...users, participant]);
    }
    connection?.on("userJoin", userJoin);
    connection?.on("userLeave", userLeave);
    connection?.on("trackAdd", addTrack);

    const u = [];
    console.log("roomparticipants", connection.room.remoteParticipants);
    const iterator = connection.room.remoteParticipants.values()
    var val = iterator.next();
    while (!val.done) {
      u.push(val.value);
      val = iterator.next();
    }
    setUsers(u);

    return () => {
      connection?.off("userJoin", userJoin);
      connection?.off("trackAdd", addTrack);
      connection?.off("userLeave", userLeave);
    };
  }, [connection]);

  useEffect(() => {
    if (!localParticipant) return;

    const track = localParticipant
      .getTrackPublications()
      .find((t) => t.kind === "audio")?.track;
    
    const trackPublishListener = (track: TrackPublication) => {
      if (track.kind !== "audio") return;
      setLocalTrack(track.track?.mediaStreamTrack!);
    }

    localParticipant.on("localTrackPublished", trackPublishListener);
    
    const cleanup = () => {
      localParticipant.off("localTrackPublished", trackPublishListener);
    }

    if (!track) {console.log("no track"); return cleanup;};
    console.log("local track", track);
    setLocalTrack(track.mediaStreamTrack);
    return cleanup;
  }, [localParticipant]);

  if (!roomInfo.space || !localParticipant) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100%",
        padding: "1.5rem",
      }}
    >
      <div>
        <div style={{ height: "70%" }}>
          <ParticipantTile
            user={roomInfo.space.members?.get(manager?.client.user?.id!)!}
            participant={localParticipant!}
            audioTrack={localTrack}
            isLocal={true}
          ></ParticipantTile>
        </div>
        <br></br>
        <div>
          <>
          {users.map((user) => {
            const member = roomInfo.space!.members?.get(user.identity);
            return (
              <div key={user.sid}>
                <ParticipantTile
                  user={member!}
                  participant={user}
                  audioTrack={tracks.find(t => t.user.identity === user.identity)?.track?.mediaStreamTrack}
                ></ParticipantTile>
              </div>
            );
          })}
          </>
        </div>
      </div>
      <div
        style={{
          marginTop: "auto",
          verticalAlign: "bottom",
          marginBottom: "3rem",
        }}
      >
        <RoomControls></RoomControls>
      </div>
    </div>
  );
}