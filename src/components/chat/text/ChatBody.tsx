import { useEffect, useRef } from "react";
import { IMessage, Room } from "@strafechat/strafe.js";
import { Message } from "./Message";

export default function ChatBody(props: { room: Room }) {
  const room = props.room;
  const scrollRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [room.messages.size()]);


  return (
    <div className="body flex-col justify-end">
      <ul
        ref={scrollRef}
        className="messages flex min-w-[5px] overflow-scroll h-fit flex-col pt-[25px]"
      >
        <div className="py-6">
          <h1 className="text-2xl font-bold inline-flex items-center">
            Welcome to #{room.name}
          </h1>
          <p className="text-base">
            This is the start of the room. {room.topic ? room.topic : ""}
          </p>
        </div>
        {
          room?.messages?.toArray()
          .sort((a, b) => a.created_at - b.created_at)
          .map((message: IMessage) => (
             <Message message={message} />
          ))
        }
      </ul>
    </div>
  )
}
