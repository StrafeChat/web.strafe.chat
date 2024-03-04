import { useEffect, useRef, useState } from "react";
import { IMessage } from "@strafechat/strafe.js";
import { useClient  } from "@/hooks";
import { Message } from "./Message";

export default function ChatBody(props: { room: any }) {
  const { room } = props;
  const scrollRef = useRef<HTMLUListElement>(null);
  const { client } = useClient();
  const [showMoreOptionsForMessages, setShowMoreOptionsForMessages] = useState(false);
  const [referenceMessage, setReferenceMessage] = useState<any | null>(null);

  const [ghostMessages, setGhostMessages] = useState([]);

useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.shiftKey) {
      setShowMoreOptionsForMessages(true);
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key == "Shift") {
      setShowMoreOptionsForMessages(false);
    }
  };

  document.addEventListener("keydown", (event) => handleKeyDown(event));
  document.addEventListener("keyup", (event) => handleKeyUp(event));

  return () => {
    document.removeEventListener("keydown", (event) => handleKeyDown(event));
    document.removeEventListener("keyup", (event) => handleKeyUp(event));
  };
}, [room]);

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
        <div className="pt-6 px-[20px]">
          <h1 className="text-2xl font-bold inline-flex items-center">
            Welcome to #{room.name}
          </h1>
          <p className="text-base">
            This is the start of the room. {room.topic ? room.topic : ""}
          </p>
        </div>
        {(() => {
            const lastMessage = room?.messages?.toArray().sort((a: any, b: any) => a.createdAt - b.createdAt)[0];
              if (lastMessage) {
                return (
                    <div className="flex mt-6 mb-3 mx-4 relative left-auto right-auto h-0 z-1 border-[0.1px] border-gray-500 items-center justify-center box-border">
                      <time className="bg-[#262626] px-4 text-sm text-gray-400 select-none font-bold uppercase">
                        {Intl.DateTimeFormat(client?.user!.locale, {
                         day: "numeric",
                         month: "long",
                         year: "numeric",
                   }).format(lastMessage.createdAt)}
              </time>
             </div>
           );
          }
        return null;
      })()}
        {
          room?.messages?.toArray()
            .sort((a: any, b: any) => a.createdAt - b.createdAt)
            .map((message: any, key: number, messages: any[]) => (
            <>
              {key > 0 && (
                <>
                  {(() => {
                    const messageDate = new Date(message.createdAt);
                    const lastMessageDate = new Date(
                      messages[key - 1].createdAt
                    );
    
                    if (
                      `${messageDate.getMonth()}/${messageDate.getDate()}/${messageDate.getFullYear()}` !=
                      `${lastMessageDate.getMonth()}/${lastMessageDate.getDate()}/${lastMessageDate.getFullYear()}`
                    )
                      return (
                        <div
                          key={key}
                          className="flex mt-4 mb-1 mx-4 relative left-auto right-auto h-0 z-1 border-[0.1px] border-gray-500 items-center justify-center box-border"
                        >
                          <time className="bg-[#262626] px-4 text-sm text-gray-400 select-none font-bold uppercase">
                            {Intl.DateTimeFormat(client?.user!.locale, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }).format(message.createdAt)}
                          </time>
                        </div>
                      );
                  })()}
                </>
              )}
              <Message
                message={message}
                key={key}
                showMoreOptions={showMoreOptionsForMessages}
                sameAuthor = {
                  key > 0 && 
                  message.author.id === messages[key - 1].author.id &&
                  (() => {
                    const messageDate = new Date(message.createdAt);
                    const lastMessageDate = new Date(messages[key - 1].createdAt);
                    return (
                      messageDate.getTime() - lastMessageDate.getTime() < 5 * 60 * 1000
                    );
                  })()
                }                
              />
            </>
          ))
        }
      </ul>
    </div>
  );
}
