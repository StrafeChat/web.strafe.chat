"use client";
import { useUI } from "@/providers/UIProvider";
import { FaNoteSticky, FaArrowRight, FaArrowLeft } from "react-icons/fa6";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { useClient } from "@/hooks";
import { useEffect } from "react";

enum OP {
  IDENTIFY = 0,

  ERROR = 20,
}

export default function Notes() {
  const { hideRoomList, setHideRoomList } = useUI();
  const { t } = useTranslation();

  const { client } = useClient();

  const friendId = "187437957982979072";

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
        </div>
      </div>
    </>
  )
}