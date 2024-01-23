"use client";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatInput from "@/components/chat/ChatInput";

export default function Page({ params }: { params: { id: string } }) {

  return (
    <>
      <ChatHeader type="pm" name={params.id} />
      <div className="body">
        <ul className="messages"></ul>
      </div>
      <ChatInput placeholder={`Message @${params.id}`} />
    </>
  );
}
