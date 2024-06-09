import { useEffect, useRef, useState, useCallback } from "react";
import { IMessage, Message, Room } from "@strafechat/strafe.js";
import { useClient } from "@/hooks";
import { MessageComponent } from "./messages/Message";

export default function ChatBody({ room }: { room: Room }) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const { client } = useClient();
  const [showMoreOptionsForMessages, setShowMoreOptionsForMessages] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const [messages, setMessages] = useState<Message[]>(room?.messages
    ?.toArray()
    .sort((a, b) => a.createdAt - b.createdAt) || []);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (messages.length < 50) setHasMore(false);

    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.scrollTop = scrollPosition;
    }

    const handleNewMessage = (message: Message) => {
      if (message.roomId !== room.id) return;
      setMessages((prevMessages) => [...prevMessages, message]);
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
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
    if (!hasMore || loadingMore) return;

    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const previousScrollHeight = scrollElement.scrollHeight;
    const previousScrollTop = scrollElement.scrollTop;

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

      if (newMessages.length < 50) setHasMore(false);

      if (newMessages.length > 0) {
        const updatedMessages = [
          ...newMessages.sort((a, b) => a.createdAt - b.createdAt)
          .map((messageData) => {
            messageData.client = client;
            return new Message(messageData);
          }),
          ...messages,
        ];

        if (updatedMessages.length > 100) {
          setMessages(updatedMessages.sort((a, b) => a.createdAt - b.createdAt).slice(0, 100));
        } else {
          setMessages(updatedMessages.sort((a, b) => a.createdAt - b.createdAt));
        }

        requestAnimationFrame(() => {
          const newScrollHeight = scrollElement.scrollHeight;
          const scrollHeightDifference = newScrollHeight - previousScrollHeight;
          scrollElement.scrollTop = previousScrollTop + scrollHeightDifference;
        });
      }
    } catch (error) {
      console.error("Failed to fetch more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [messages, hasMore, client, room, loadingMore]);

  const fetchLatestMessages = useCallback(async () => {
    if (fetchingLatest) return;

    setFetchingLatest(true);
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const firstMessage = messages.sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!firstMessage) return;

    setHasMore(true);

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

        if (updatedMessages.length > 100) {
          setMessages(updatedMessages.sort((a, b) => a.createdAt - b.createdAt).slice(-100));
        } else {
          setMessages(updatedMessages.sort((a, b) => a.createdAt - b.createdAt));
        }
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

      const scrollPosition = scrollHeight - clientHeight - scrollTop;

      if (scrollTop === 0 && hasMore && !loadingMore) {
        fetchMoreMessages();
      } else if (scrollPosition < 20 && !fetchingLatest) {
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
  }, [fetchMoreMessages, fetchLatestMessages, hasMore, loadingMore, fetchingLatest]);

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

        {!hasMore && (
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
          if (lastMessage && !hasMore) {
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
          <div key={message.id}>
            {key > 0 &&
              (() => {
                const messageDate = new Date(message.createdAt);
                const lastMessageDate = new Date(
                  messages.sort((a: any, b: any) => a.createdAt - b.createdAt)[
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
                  messages.sort((a: any, b: any) => a.createdAt - b.createdAt)[
                    key - 1
                  ].author.id &&
                (() => {
                  const lastMessage = messages.sort(
                    (a: any, b: any) => a.createdAt - b.createdAt
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
