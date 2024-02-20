import { useEffect, useRef } from "react";
import { IMessage } from "@strafechat/strafe.js";
import { useClient  } from "@/hooks";
import { Message } from "./Message";

export default function ChatBody(props: { room: any }) {
  const { room } = props;
  const scrollRef = useRef<HTMLUListElement>(null);
  const { client } = useClient();

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
        {(() => {
                  if (room?.messages?.toArray()[0])
                    return (
                      <div className="flex mt-6 mb-6 ml-3 mr-3 relative left-auto right-auto h-0 z-1 border-[0.1px] border-gray-500 items-center justify-center box-border">
                        <time className="bg-[#262626] px-4 text-sm text-gray-400 select-none font-bold uppercase">
                          {Intl.DateTimeFormat(client?.user!.locale, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }).format(new Date(room?.messages?.toArray()[0].createdAt))}
                        </time>
                      </div>
                    );
                })()}
        {
          room?.messages?.toArray()
            .sort((a: any, b: any) => a.createdAt - b.createdAt)
            .map((message: any, key: number, messages: any[]) => (
              <Message
                message={message}
                key={key}
                sameAuthor={
                  key > 0 && message.authorId === messages[key - 1].authorId &&
                  (() => {
                    const messageDate = new Date(message.createdAt);
                    const lastMessageDate = new Date(messages[key - 1].createdAt);
                    return `${messageDate.getMonth()}/${messageDate.getDate()}/${messageDate.getFullYear()}` === `${lastMessageDate.getMonth()}/${lastMessageDate.getDate()}/${lastMessageDate.getFullYear()}`;
                  })()
                }
              />
            ))
        }
      </ul>
    </div>
  );
}
