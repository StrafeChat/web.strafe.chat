"use client";

import { ChatBody, ChatHeader, ChatInput } from "@/components/chat";
import MemberList from "@/components/chat/MemberList";

export default function Page({ params }: { params: { id: string, roomId: string } }) {

  return (
    <>
      <ChatHeader type="server" name={params.roomId} />
      <div className="flex flex-grow">
        <div className="flex flex-col flex-grow">
          <ChatBody />
          <ChatInput placeholder="Type a message" />
        </div>
        <MemberList />
      </div>
    </>
  )
}