"use client";
import { useUI } from "@/providers/UIProvider";
import { FaNoteSticky, FaArrowRight, FaArrowLeft } from "react-icons/fa6";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useClient, useModal, useVoice } from "@/hooks";
import { useEffect, useRef, useState } from "react";
import { P2PConnection } from "@strafechat/strafe.js/dist/voice/P2PConnection";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

enum OP {
  IDENTIFY = 0,
  ACK = 1, // confirmation of a message
  SETTINGS = 2,
  NEGOTIATION = 3,

  ERROR = 20,
}

export default function Notes() {
  const { hideRoomList, setHideRoomList } = useUI();
  const { t } = useTranslation();

  const { client } = useClient();
  const { openCallbackModal } = useModal();
  const { setRoomInfo, setConnection } = useVoice();

  const [selfViewTrack, setSelfViewTrack] = useState<MediaStream | null>(null);
  const [remoteViewTrack, setRemoteViewTrack] = useState<MediaStream | null>(
    null
  );

  // const friendId = "187437957982979072"; RedTech Programming
  const friend = useRef<HTMLInputElement | null>(null);

  var con: P2PConnection | null = null;

  const kinds: string[] = [];
  const tracks: MediaStreamTrack[] = [];

  const init = async () => {
    if (!client) return console.error("Client not initialized");

    try {
      con = await client.voice.callUser(friend.current!.value);
    } catch (e: any) {
      return toast({
        title: "Error",
        description: e.message,
        duration: 5000,
        variant: "destructive",
      });
    }
    setupEvents();
  };
  const setupEvents = () => {
    kinds.length = 0;
    con!.on("callStart", async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: await deviceChooser(),
          },
          video: true,
        });
        for (const track of stream.getTracks()) {
          con!.addTrack(track, stream);
        }
        setSelfViewTrack(stream);
      } catch (e) {
        console.error("Failed to get user media", e);
      }
    });
    con!.on("trackAdd", (data) => {
      /*if (kinds.includes(data.track.kind)) return;
      kinds.push(data.track.kind);
      tracks.push(data.track);
      const stream = new MediaStream(tracks);
      console.log(stream, data.stream);*/
      console.log("trackAdd", data);
      if (remoteViewTrack) return;
      setRemoteViewTrack(data.stream);
    });
  };

  useEffect(() => {
    if (!client) return;

    const startCall = async (callData: { caller: string; token: string }) => {
      console.log("callData", callData);
      const join = prompt("Join call with " + callData.caller + "? (y/n)");
      if (join !== "y") return;

      con = client.voice.joinCall(callData.token, callData.caller);
      setupEvents();
    };

    client.on("callInit", startCall);

    return () => {
      client.off("callInit", startCall);
    };
  }, [client]);

  const deviceChooser = (): Promise<ConstrainDOMString> => {
    return new Promise(async (res, rej) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return res("default");
      }

      const s = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "audioinput"
      );

      const id = (await openCallbackModal("choose-device", {
        devices,
      })) as ConstrainDOMString & "strafechat-cancel";
      s.getTracks().forEach((t) => t.stop());
      if (id === "strafechat-cancel") return rej();

      return res(id); // TODO: fix this
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          devices = devices.filter((d) => d.kind === "audioinput");

          console.log(devices, "opening");
        })
        .catch((e) => {
          console.warn(e);
          return "default";
        });
    });
  };

  return (
    <>
      <div className="header-container">
        <div className="header">
          <span className="flex items-center gap-[3px]">
            {hideRoomList ? (
              <>
                <FaNoteSticky onClick={() => setHideRoomList(!hideRoomList)} />
                <FaArrowRight
                  className="!w-[12px] !h-[12px]"
                  onClick={() => setHideRoomList(!hideRoomList)}
                />
              </>
            ) : (
              <>
                <FaArrowLeft
                  className="!w-[13px] !h-[13px]"
                  onClick={() => setHideRoomList(!hideRoomList)}
                />
                <FaNoteSticky onClick={() => setHideRoomList(!hideRoomList)} />
              </>
            )}
          </span>
          <span>
            <b>{t("notes_page.header")}</b>
          </span>
        </div>
        <div className="p-10">
          <p>This page is currently being used to test p2p calls.</p>

          <Input
            placeholder="UserId to call"
            ref={friend}
            defaultValue={"187437957982979072"}
            type="text"
          ></Input>
          <Button
            variant={"default"}
            onClick={() => {
              init();
            }}
          >
            Start connection
          </Button>

          <br></br>
          <div className="flex flex-grid p-2">
            <video
              className="rounded-lg mx-2 aspect-video"
              autoPlay
              playsInline
              ref={(ref) => {
                if (!ref) return;
                ref.srcObject = selfViewTrack;
              }}
            ></video>

            <video
              className="mx-2 aspect-video rounded-lg"
              autoPlay
              playsInline
              ref={(ref) => {
                if (!ref) return;
                console.log("remoteViewTrack", remoteViewTrack);
                ref.srcObject = remoteViewTrack;
              }}
            ></video>
          </div>
        </div>
      </div>
    </>
  );
}