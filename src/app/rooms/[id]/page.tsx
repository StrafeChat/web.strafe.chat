"use client";
import { useAuth } from "@/context/AuthContext";
import { Room, useRoom } from "@/context/RoomContext";
import { faPhone, faVideoCamera, faXmarkCircle } from "@fortawesome/free-solid-svg-icons";
import ChatBox from "@/components/room/ChatBox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState, useRef } from "react";
import cookie from "js-cookie";
import Message from "@/components/room/Message";
import { cacheMessages, getCachedMessages } from "@/scripts/Caching";

export default function Page({ params }: { params: { id: string } }) {
  const { user, ws } = useAuth();
  const { pms } = useRoom();
  const scrollRef = useRef<HTMLUListElement>(null);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadedMessageIds, setLoadedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [showMoreOptionsForMessages, setShowMoreOptionsForMessages] =
    useState(false);
  const [referenceMessage, setReferenceMessage] = useState<any | null>(null);

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
  }, [currentRoom]);

  useEffect(() => {
    setCurrentRoom(pms.find((pm) => pm.id == params.id) ?? null);
    (async () => {
      if (currentRoom) {
        const cachedMessages = await getCachedMessages(currentRoom.id);
        if (cachedMessages) {
          setMessages(cachedMessages);
          setLoadedMessageIds(new Set(cachedMessages.map((msg) => msg.id)));
        } else {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API}/rooms/${params.id}/messages`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: cookie.get("token")!,
              },
            }
          );

          const data = await res.json();

          if (res.ok) {
            setMessages(data);
            setLoadedMessageIds(new Set(data.map((msg: any) => msg.id)));
            cacheMessages(currentRoom.id, data);
          }
        }
      }
    })();
  }, [currentRoom, params, pms, ws]);

  useEffect(() => {
    const handleWsMessage = (evt: MessageEvent<any>) => {
      const { op, data, event } = JSON.parse(evt.data);
      switch (op) {
        case 3:
          switch (event) {
            case "MESSAGE_CREATE":
              if (currentRoom) {
                if (currentRoom.id == data.room_id)
                  setMessages((prev) => [...prev, data]);
                setLoadedMessageIds((prev) => new Set([...prev]));
              }
              break;
            case "MESSAGE_UPDATE":
              if (currentRoom) {
                if (currentRoom.id == data.room_id)
                  setMessages((prevMessages) =>
                    prevMessages.map((message) =>
                      message.id == data.id ? data : message
                    )
                  );
              }
              break;
          }
        case "MESSAGE_DELETE":
          if (currentRoom) {
            if (currentRoom.id == data.room_id)
              setMessages((prevMessages) =>
                prevMessages.filter((message) => message.id != data.message_id)
              );
          }
          break;
      }
    };

    ws?.current?.addEventListener("message", handleWsMessage);

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ws?.current?.removeEventListener("message", handleWsMessage);
    };
  }, [currentRoom, messages, ws]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const loadOlderMessages = async () => {
      const oldestMessageId =
        messages.length > 0 ? messages[messages.length - 1].id : null;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API}/rooms/${params.id}/messages?before=${oldestMessageId}&limit=25`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: cookie.get("token")!,
          },
        }
      );

      const data = await res.json();

      if (res.ok && currentRoom) {
        const newMessages = data.filter(
          (message: any) => !loadedMessageIds.has(message.id)
        );
        if (newMessages.length < 1) return;
        setMessages((prev) => [...newMessages, ...prev]);
        setLoadedMessageIds(
          (prevIds) =>
            new Set([...prevIds, ...newMessages.map((msg: any) => msg.id)])
        );
        cacheMessages(currentRoom.id, [...newMessages, ...messages]);
      }
    };

    const handleScroll = async () => {
      if (scrollRef.current) {
        const scrollTop = scrollRef.current.scrollTop;
        const scrollHeight = scrollRef.current.scrollHeight;
        const clientHeight = scrollRef.current.clientHeight;

        if (scrollTop === 0 && scrollHeight > clientHeight) {
          await loadOlderMessages();
        }
      }
    };

    scrollRef.current?.addEventListener("scroll", handleScroll);

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      scrollRef.current?.removeEventListener("scroll", handleScroll);
    };
  }, [currentRoom, loadedMessageIds, messages, params.id]);

  switch (currentRoom?.type) {
    case 0:
      return (() => {
        const currentUser = currentRoom.recipients!.find(
          (recipient) => recipient.id != user.id
        );
        return (
          <div className="h-full pb-[50px]">
            <div className="header">
              <div className="between">
                <span>
                  <b>@{currentUser?.global_name ?? currentUser?.username}</b>
                </span>
                <span className="flex gap-5 items-center text-2xl">
                  <FontAwesomeIcon icon={faPhone} />
                  <FontAwesomeIcon icon={faVideoCamera} />
                </span>
              </div>
            </div>
            <div className="messages-wrapper">
              <ul
                ref={scrollRef}
                className="messages"
              >
                <div className="pt-[25px] pl-[15px] text-white">
                  <h2 className="text-[27px] font-bold">
                    @{currentUser?.global_name ?? currentUser?.username}
                  </h2>
                  <p>This is the start of your conversation.</p>
                </div>

                {(() => {
                  if (messages[0])
                    return (
                      <div className="flex mt-6 mb-6 ml-3 mr-3 relative left-auto right-auto h-0 z-1 border-[0.1px] border-gray-500 items-center justify-center box-border">
                        <time className="bg-[#262626] px-4 text-sm text-gray-400 select-none font-bold uppercase">
                          {Intl.DateTimeFormat(user.locale, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }).format(new Date(messages[0].created_at))}
                        </time>
                      </div>
                    );
                })()}
                {messages.map((message, key) => (
                  <>
                    {key > 0 && (
                      <>
                        {(() => {
                          const messageDate = new Date(message.created_at);
                          const lastMessageDate = new Date(
                            messages[key - 1].created_at
                          );

                          if (
                            `${messageDate.getMonth()}/${messageDate.getDate()}/${messageDate.getFullYear()}` !=
                            `${lastMessageDate.getMonth()}/${lastMessageDate.getDate()}/${lastMessageDate.getFullYear()}`
                          )
                            return (
                              <div
                                key={key}
                                className="flex mt-6 mb-2 ml-3 mr-3 relative left-auto right-auto h-0 z-1 border-[0.1px] border-gray-500 items-center justify-center box-border"
                              >
                                <time className="bg-[#262626] px-4 text-sm text-gray-400 select-none font-bold uppercase">
                                  {Intl.DateTimeFormat(user.locale, {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  }).format(new Date(message.created_at))}
                                </time>
                              </div>
                            );
                        })()}
                      </>
                    )}
                    <Message
                      key={key}
                      sameAuthor={
                        key > 0 &&
                        message.author.id === messages[key - 1].author.id &&
                        (() => {
                          const messageDate = new Date(message.created_at);
                          const lastMessageDate = new Date(
                            messages[key - 1].created_at
                          );
                          return (
                            `${messageDate.getMonth()}/${messageDate.getDate()}/${messageDate.getFullYear()}` ===
                            `${lastMessageDate.getMonth()}/${lastMessageDate.getDate()}/${lastMessageDate.getFullYear()}`
                          );
                        })()
                      }
                      showMoreOptions={showMoreOptionsForMessages}
                      setReferenceMessage={setReferenceMessage}
                      messages={messages}
                      message={message}
                      recipients={currentRoom.recipients}
                    />
                  </>
                ))}
              </ul>
              {referenceMessage && (
                <div className="reply-popup h-[35px] pb-[7px] pt-2 ml-3 mr-3 justify-center">
                  <span>Replying to {referenceMessage.author.username}</span>
                  <span className="icon"><FontAwesomeIcon onClick={() => setReferenceMessage(null)} icon={faXmarkCircle}/></span>
                </div>
              )}
              <ChatBox room={currentRoom} setReferenceMessage={setReferenceMessage} referenceMessage={referenceMessage} />
            </div>
          </div>
        );
      })();
  }
}
