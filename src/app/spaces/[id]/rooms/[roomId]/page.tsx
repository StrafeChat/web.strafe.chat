"use client";
import ChatHeader from "@/components/chat/ChatHeader";

export default function Page({ params }: { params: { id: string, roomId: string } }) {

  return (
    <>
      <ChatHeader type="server" name="Strafe" />
    </>
  )
}