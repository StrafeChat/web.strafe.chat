import { useEffect, useRef, useState, useCallback } from "react";
import { IMessage, Message, Room } from "@strafechat/strafe.js";
import { useClient } from "@/hooks";
import { MessageComponent } from "./messages/Message";

export default function ChatBody({ room, scrollToMessageId }: { room: Room, scrollToMessageId?: string }) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { client } = useClient();
  const [showMoreOptionsForMessages, setShowMoreOptionsForMessages] = useState(false);
  const [hasMoreUp, setHasMoreUp] = useState(true);
  const [hasMoreDown, setHasMoreDown] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const [messages, setMessages] = useState<Message[]>(room?.messages
    ?.toArray()
    .sort((a, b) => a.createdAt - b.createdAt) || []);
  const [scrollFraction, setScrollFraction] = useState(1);

  useEffect(() => {
    if (messages.length < 100) setHasMoreUp(false);

    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }

    const handleNewMessage = (message: Message) => {
      if (message.roomId !== room.id) return;
      setMessages((prevMessages) => [...prevMessages, message]);

      setTimeout(() => {
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }
     }, 5)
    };

    const handleDeleteMessage = (message: Message) => {
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== message.id)
      );
    };

    client?.on("messageCreate", handleNewMessage);
    client?.on("messageDelete", handleDeleteMessage);

    return () => {
      client?.off("messageCreate", handleNewMessage);
      client?.off("messageDelete", handleDeleteMessage);
    };
  }, [client]);

  const fetchMoreMessages = useCallback(async () => {
    if (!hasMoreUp || loadingMore) return;

    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const previousScrollHeight = scrollElement.scrollHeight;
    const previousScrollTop = scrollElement.scrollTop;
    const previousScrollFraction = previousScrollTop / previousScrollHeight;

    const lastMessage = messages[0];
    if (!lastMessage) return;

    setLoadingMore(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API}/rooms/${room.id}/messages?before=${lastMessage.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: `${localStorage.getItem("token")!}`,
          },
        }
      );
      const resData = await response.json();
      const newMessages: any[] = resData.messages;

      if (newMessages.length < 100) setHasMoreUp(false);

      if (newMessages.length > 0) {
        const updatedMessages = [
          ...newMessages.sort((a, b) => a.createdAt - b.createdAt)
          .map((messageData) => {
            messageData.client = client;
            return new Message(messageData);
          }),
          ...messages,
        ];

        setMessages(updatedMessages.sort((a, b) => a.createdAt - b.createdAt).slice(0, 100));
        setHasMoreDown(true);

        requestAnimationFrame(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight * previousScrollFraction;
        });
      }
    } catch (error) {
      console.error("Failed to fetch more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [messages, hasMoreUp, client, room, loadingMore]);

  const fetchLatestMessages = useCallback(async () => {
    if (!hasMoreDown || fetchingLatest) return;

    setFetchingLatest(true);
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const previousScrollHeight = scrollElement.scrollHeight;
    const previousScrollTop = scrollElement.scrollTop;
    const previousScrollFraction = previousScrollTop / previousScrollHeight;

    const firstMessage = messages[messages.length - 1];
    if (!firstMessage) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API}/rooms/${room.id}/messages?after=${firstMessage.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: `${localStorage.getItem("token")!}`,
          },
        }
      );
      const resData = await response.json();
      const newMessages: any[] = resData.messages;

      if (newMessages.length > 0) {
        const updatedMessages = [
          ...messages,
          ...newMessages.sort((a, b) => a.createdAt - b.createdAt)
            .map((messageData) => {
              messageData.client = client;
              return new Message(messageData);
            }),
        ];

        setHasMoreUp(true);

        if (updatedMessages.length > 100) {
          setMessages(updatedMessages.sort((a, b) => a.createdAt - b.createdAt).slice(-100));
        } else {
          setMessages(updatedMessages.sort((a, b) => a.createdAt - b.createdAt));
        }

        requestAnimationFrame(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight * previousScrollFraction;
        });
      }
    } catch (error) {
      console.error("Failed to fetch latest messages:", error);
    } finally {
      setFetchingLatest(false);
    }
  }, [messages, client, room, fetchingLatest]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey) {
        setShowMoreOptionsForMessages(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShowMoreOptionsForMessages(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollableDiv = scrollRef.current;
      if (!scrollableDiv) return;
      const scrollTop = scrollableDiv.scrollTop;
      const scrollHeight = scrollableDiv.scrollHeight;
      const clientHeight = scrollableDiv.clientHeight;

      setScrollFraction(scrollTop / scrollHeight);

      const scrollPosition = scrollHeight - clientHeight - scrollTop;

      if (scrollTop === 0 && hasMoreUp && !loadingMore) {
        fetchMoreMessages();
      } else if (scrollPosition < 20 && hasMoreDown && !fetchingLatest) {
        fetchLatestMessages();
      }
    };

    const scrollableDiv = scrollRef.current;
    if (scrollableDiv) {
      scrollableDiv.addEventListener("scroll", handleScroll, { passive: true }); // Use passive option for smoother scrolling
    }

    return () => {
      if (scrollableDiv) {
        scrollableDiv.removeEventListener("scroll", handleScroll);
      }
    };
  }, [fetchMoreMessages, fetchLatestMessages, hasMoreUp, hasMoreDown, loadingMore, fetchingLatest]);

  useEffect(() => {
    if (scrollToMessageId && messageRefs.current[scrollToMessageId]) {
      messageRefs.current[scrollToMessageId]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollToMessageId, messages]);

  return (
    <div className="body flex-col justify-end z-10 relative">
      <ul
        ref={scrollRef}
        className="messages flex min-w-[5px] overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-600 h-fit flex-col pt-[25px]"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!hasMoreUp && (
          <div className="pt-6 px-[20px]">
            <h1 className="text-2xl font-bold inline-flex items-center">
              Welcome to #{room.name}
            </h1>
            <p className="text-base">
              This is the start of the room. {room.topic ? room.topic : ""}
            </p>
          </div>
        )}
        {(() => {
          const lastMessage = messages[0];
          if (lastMessage && !hasMoreUp) {
            return (
              <div className="flex mt-4 mb-1 mx-4 relative left-auto right-auto h-0 border-[0.009px] border-gray-600 items-center justify-center box-border">
                <time className="bg-[#262626] px-1.5 text-xs text-gray-400 select-none font-bold uppercase">
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
        {messages.map((message, key) => (
          <div key={message.id} ref={el => messageRefs.current[message.id] = el}>
            {key > 0 &&
              (() => {
                const messageDate = new Date(message.createdAt);
                const lastMessageDate = new Date(
                  messages.sort((a, b) => a.createdAt - b.createdAt)[
                    key - 1
                  ].createdAt!
                );

                if (
                  `${messageDate.getMonth()}/${messageDate.getDate()}/${messageDate.getFullYear()}` !==
                  `${lastMessageDate.getMonth()}/${lastMessageDate.getDate()}/${lastMessageDate.getFullYear()}`
                ) {
                  return (
                    <div className="flex mt-4 mb-1 mx-4 relative left-auto right-auto h-0 border-[0.009px] border-gray-600 items-center justify-center box-border">
                      <time className="bg-[#262626] px-1.5 text-xs text-gray-400 select-none font-bold uppercase">
                        {Intl.DateTimeFormat(client?.user!.locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }).format(message.createdAt)}
                      </time>
                    </div>
                  );
                }
                return null;
              })()}
            <MessageComponent
              message={message}
              key={key}
              showMoreOptions={showMoreOptionsForMessages}
              sameAuthor={
                key > 0 &&
                message.author.id ===
                  messages.sort((a, b) => a.createdAt - b.createdAt)[
                    key - 1
                  ].author.id &&
                (() => {
                  const lastMessage = messages.sort(
                    (a, b) => a.createdAt - b.createdAt
                  )[key - 1];
                  const messageDate = new Date(message.createdAt);
                  const lastMessageDate = new Date(lastMessage.createdAt);
                  if (message.sudo) {
                    if (!lastMessage.sudo) return false;
                    if (message.sudo.name !== lastMessage.sudo!.name)
                      return false;
                  } else if (lastMessage.sudo) return false;
                  return (
                    messageDate.getTime() - lastMessageDate.getTime() <
                    5 * 60 * 1000
                  );
                })()
              }
            />
          </div>
        ))}
      </ul>
    </div>
  );
}