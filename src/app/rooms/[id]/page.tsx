"use client";

import { ChatBody, ChatHeader, ChatInput } from "@/components/chat";

export default function Page({ params }: { params: { id: string } }) {

  return (
    <>
      <ChatHeader type="pm" name={params.id} />
      <ChatBody />
      <ChatInput placeholder={`Message @${params.id}`} />
    </>
  );
}
