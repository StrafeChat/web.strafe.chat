import { useEffect, useRef } from "react";
import { IMessage, Room } from "@strafechat/strafe.js";
import { Message } from "./Message";

export default function ChatBody(props: { room: any }) {
  const room = props.room;
  const scrollRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [room.messages.size()]);

// console.log(room?.messages?.toArray()[key - 1])

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
          .sort((a: any, b: any) => a.createdAt - b.createdAt)
          .map((message: any, key: number) => {
            console.log(key > 0 && message.authorId === room?.messages?.toArray()[key - 1].au)
             return <Message message={message} key={key} sameAuthor={
              key > 0 && message.authorId === room?.messages?.toArray()[key - 1].authorId && (() => {
                const messageDate = new Date(message.createdAt);
                const lastMessageDate = new Date(room?.messages?.toArray()[key - 1].createdAt);
                return `${messageDate.getMonth()}/${messageDate.getDate()}/${messageDate.getFullYear()}` === `${lastMessageDate.getMonth()}/${lastMessageDate.getDate()}/${lastMessageDate.getFullYear()}`;
              })()
            } />
})
        }
      </ul>
    </div>
  )
}
