"use client";
import TextRoom from "@/components/chat/TextRoom";
import VoiceRoom from "@/components/chat/VoiceRoom";
import { useState } from 'react'
import { useClient } from "@/hooks";

export default function Page({ params }: { params: { id: string, roomId: string } }) {
  const { client } = useClient();
  let [hideSidebar, setHideSidebar] =  useState(false);
  let hideEv = new CustomEvent("hide-sidebar", { bubbles: true });
  typeof window !== "undefined" &&  window.addEventListener("hide-sidebar", () => {
    setHideSidebar(!hideSidebar);
  });

  const space = client?.spaces.get(params.id);
  if (!space) return <h1>Space not found.</h1>
  const room = space.rooms.get(params.roomId);
  if (!room) return <h1>Room not found.</h1>
  let component;
  
  switch(room.type) {
    case 1:
      component = <TextRoom space={space} room={room} hidden={hideSidebar} />;
      break;
    case 2:
      component = <VoiceRoom space={space} room={room} hidden={hideSidebar} />;
      break;
    default:
      component = <h1>Unkown room type.</h1>;
  }

  return (
    <>
      {component}
    </>
  )
}
