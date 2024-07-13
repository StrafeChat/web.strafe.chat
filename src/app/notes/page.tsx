"use client";
import { useUI } from "@/providers/UIProvider";
import { FaNoteSticky, FaArrowRight, FaArrowLeft } from "react-icons/fa6";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { useClient } from "@/hooks";
import { useEffect, useState } from "react";

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

  const [selfViewTrack, setSelfViewTrack] = useState<MediaStream | null>(null);
  const [remoteViewTrack, setRemoteViewTrack] = useState<MediaStream | null>(null);

  const friendId = "187437957982979072";
  var polite = false;

  var pc: RTCPeerConnection | null = null;
  var makingOffer = false;

  const init = async () => {
    if (!client) return console.warn("client not set");
    const ids = [client.user?.id, friendId].sort();
    const roomId = ids.join(":");

    const res = await fetch("http://localhost:3001/v1/portal/personal/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: client.token!,
      },
      body: JSON.stringify({ roomId }),
    });

    const resData = await res.json();
    if (!res.ok) return console.error("Failed to join room", resData);

    console.log("token", resData);
    connectWebsocket(resData.token);
  }

  const connectWebsocket = (token: string) => {
    const ws = new WebSocket("ws://localhost:3001/portal/signaling/p2p");
    ws.onopen = () => {
      ws.send(JSON.stringify({
        op: OP.IDENTIFY,
        data: {
          token,
          id: client!.user!.id,
        }
      }));
    }
    ws.onclose = (message) => {
      console.warn("closed", message, message.reason);
    }

    let ignoreOffer = false;
    ws.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      console.log("message", data);
      switch (data.op) {
        case OP.SETTINGS:
          polite = data.data.role === "polite" ? true : false;
          sendMessage(OP.ACK, { id: data.data.id });

          console.log("settings received");

          startNegotiation();
          break;
        case OP.NEGOTIATION:
          const { description, candidate } = data.data;
          try {
            if (description) {
              const offerCollision = 
                description.type === "offer" &&
                (makingOffer || pc!.signalingState !== "stable");
              
              ignoreOffer = !polite && offerCollision;
              if (ignoreOffer) return;

              await pc!.setRemoteDescription(description);
              if (description.type === "offer") {
                await pc!.setLocalDescription();
                sendMessage(OP.NEGOTIATION, { description: pc!.localDescription });
              }
            } else if (candidate) {
              try {
                await pc!.addIceCandidate(candidate);
              } catch(err) {
                if (!ignoreOffer) {
                  throw err;
                }
              }
            }
          } catch(e) {
            console.error(e);
          }
        break;
      }
    }

    const startNegotiation = async () => {
      pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302"
          }
        ]
      });
      
      startMedia();

      pc.ontrack = ({ track, streams }) => {
        track.onunmute = () => {
          if (remoteViewTrack) {
            return;
          }
          setRemoteViewTrack(streams[0]);
        }
      }
      pc.onnegotiationneeded = async () => {
        console.log("negotionation needed");
        try {
          makingOffer = true;
          await pc!.setLocalDescription();
          sendMessage(OP.NEGOTIATION, { description: pc!.localDescription });
        } catch(e) {
          console.error("Failed to set local description", e);
        } finally {
          makingOffer = false;
        }
      }
      pc.onicecandidate = ({ candidate }) => {
        sendMessage(OP.NEGOTIATION, { candidate });
      }
    }

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        for (const track of stream.getTracks()) {
          pc!.addTrack(track, stream);
        }
        setSelfViewTrack(stream);
      } catch (e) {
        console.error("Failed to get user media", e);
      }
    }

    const sendMessage = (op: OP, data: any) => {
      ws.send(JSON.stringify({ op, data }));
    }
  }

  useEffect(() => {
    if (!client) return;

    const startCall = async (callData: { caller: string, token: string }) => {
      console.log("callData", callData);
      const join = prompt("Join call with " + callData.caller + "? (y/n)");
      if (join !== "y") return;

      console.log("jointoken", callData.token);

      connectWebsocket(callData.token);
    }

    client.on("callInit", startCall);

    return () => {
      client.off("callInit", startCall);
    }
  }, [client]);

  return (
    <>
      <div className="header-container">
        <div className="header">
          <span className="flex items-center gap-[3px]">
            {hideRoomList ? (
              <>
                <FaNoteSticky onClick={() => setHideRoomList(!hideRoomList)} />
                <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
              </>
            ) : (
              <>
                <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
                <FaNoteSticky onClick={() => setHideRoomList(!hideRoomList)} />
              </>
            )}
          </span>
          <span><b>{t('notes_page.header')}</b></span>
        </div>
        <div>
          <h1>Notes Page</h1>

          <p>This page is currently being used to test p2p calls.</p>

          <Button variant={"default"} onClick={() => {
            init();
          }}>Start connection</Button>

          <br></br>

          <video autoPlay playsInline muted ref={(ref) => {
            if (!ref) return;
            ref.srcObject = selfViewTrack;
          }}></video>

          <video autoPlay playsInline ref={(ref) => {
            if (!ref) return;
            ref.srcObject = remoteViewTrack;
          }}></video>
        </div>
      </div>
    </>
  )
}