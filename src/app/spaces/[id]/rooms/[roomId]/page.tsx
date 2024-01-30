"use client";

import { ChatBody, ChatHeader, ChatInput } from "@/components/chat";
import MemberList from "@/components/chat/MemberList";
import {useState} from 'react'
export default function Page({ params }: { params: { id: string, roomId: string } }) {
  let [hideSidebar, setHideSidebar] =  useState(false);
  let hideEv = new CustomEvent("hide-sidebar", { bubbles: true });
  typeof window !== "undefined" &&  window.addEventListener("hide-sidebar", () => {
    setHideSidebar(!hideSidebar);
  });
  return (
    <>
      <ChatHeader type="server" name={params.roomId} />
      <div className="flex flex-grow">
        <div className="flex flex-col flex-grow">
          <ChatBody />
          <ChatInput placeholder="Type a message" />
        </div>
        <MemberList hidden={hideSidebar} />
      </div>
    </>
  )
}