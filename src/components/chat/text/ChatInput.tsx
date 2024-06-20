import { Room } from "@strafechat/strafe.js";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  ClipboardEventHandler,
} from "react";
import { useClient } from "@/hooks";
import { FaFaceSmile, FaPlus } from "react-icons/fa6";
import { emojis } from "@/assets/emojis";
import twemoji from "twemoji";
import React from "react";
import { Formatting } from "@/helpers/formatter";

export function ChatInput({
  placeholder,
  room,
}: {
  placeholder: string;
  room: Room;
}) {
  const { client } = useClient();
  const inputRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const emojiPopupRef = useRef<HTMLDivElement>(null);
  const maxCharacters = 2000;
  const [characterCount, setCharacterCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<
    {
      avatar: string | undefined;
      id: string;
      displayName: string;
    }[]
  >([]);
  const [currentlyTyping, setCurrentlyTyping] = useState<boolean>(false);
  const [emojiPopupVisible, setEmojiPopupVisible] = useState(false);
  const [filteredEmojis, setFilteredEmojis] = useState<{
    [key: string]: string;
  }>({});
  const [emojiSearch, setEmojiSearch] = useState("");

  useEffect(() => {
    let typingTimeout: NodeJS.Timeout;

    const handleTypingStart = (data: any) => {
      if (data.room_id !== room.id) return;
      const { id, global_name, username, avatar } = data.user;
      const displayName = global_name || username;
      if (id === client?.user?.id) return;
      setTypingUsers((prevUsers) => {
        if (!prevUsers.some((user) => user.id === id)) {
          return [...prevUsers, { id, displayName, avatar }];
        }
        return prevUsers;
      });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        setTypingUsers((prevUsers) =>
          prevUsers.filter((user) => user.id !== id)
        );
      }, 10000);
    };

    const handleMessageCreate = (message: any) => {
      setTypingUsers((prevUsers) =>
        prevUsers.filter((user) => user.id !== message.author.id)
      );
    };

    client?.on("typingStart", handleTypingStart);
    client?.on("messageCreate", handleMessageCreate);

    return () => {
      client?.off("typingStart", handleTypingStart);
      client?.off("messageCreate", handleMessageCreate);
      clearTimeout(typingTimeout);
    };
  }, [client, room.id]);

  const handleInput = useCallback(async () => {
    if (inputRef.current) {
      const text = inputRef.current.innerText;
      setContent(text);
      setCharacterCount(text.length);

      const match = text.match(/:([a-zA-Z0-9_+-]{2,})$/);
      if (match) {
        const search = match[1];
        setEmojiSearch(search);
        setFilteredEmojis(
          Object.fromEntries(
            Object.entries(emojis).filter(([name]) => name.startsWith(search))
          )
        );
        setEmojiPopupVisible(true);
      } else {
        setEmojiPopupVisible(false);
      }

      if (!currentlyTyping && text.length > 0) {
        setCurrentlyTyping(true);
        await room.sendTyping();
        setTimeout(() => {
          setCurrentlyTyping(false);
        }, 10000);
      }
    }
  }, [room, currentlyTyping]);

  const handlePaste: ClipboardEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand("insertText", false, text);
    } catch (error) {
      console.error("Failed to read text from clipboard:", error);
    }
  };

  useEffect(() => {
    const input = inputRef.current;

    if (input) {
      input.addEventListener("input", handleInput);
    }

    return () => {
      if (input) {
        input.removeEventListener("input", handleInput);
      }
    };
  }, [handleInput]);
  useEffect(() => {
    if (emojiPopupVisible) {
      const popup = emojiPopupRef.current;
      if (popup) {
        twemoji.parse(popup, {
          folder: "svg",
          ext: ".svg",
          className: "w-7 h-7",
        });
      }
    }
  }, [emojiPopupVisible, filteredEmojis]);

  const handleEmojiSelect = (emoji: string) => {
    if (inputRef.current) {
      const text = inputRef.current.innerText;
      const newText = text.replace(/:([a-zA-Z0-9_+-]*)$/, emoji);
      inputRef.current.innerText = newText;
      setContent(newText);
      setCharacterCount(newText.length);
    }
  };

  const handleClearContent = () => {
    if (inputRef.current) {
      inputRef.current.innerText = "";
      setContent("");
      setCharacterCount(0);
      setEmojiPopupVisible(false);
      setEmojiSearch("");
      setFilteredEmojis({});
    }
  };

  const handleEmojiPopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      // Select emoji when Enter is pressed
      const emojiName = event.currentTarget.getAttribute("data-name");
      if (emojiName && filteredEmojis[emojiName]) {
        handleEmojiSelect(`:${emojiName}:`);
      }
    } else if (event.key === "Escape") {
      // Close emoji popup on Escape
      setEmojiPopupVisible(false);
      inputRef.current?.focus(); // Return focus to the input
    } else if (event.key === "Tab" && !event.shiftKey) {
      // Prevent tabbing out of emoji popup
      event.preventDefault();
      const nextEmojiItem = event.currentTarget.nextElementSibling as HTMLElement;
      if (nextEmojiItem) {
        nextEmojiItem.focus();
      }
    } else if (event.key === "Tab" && event.shiftKey) {
      // Prevent tabbing out of emoji popup (reverse direction)
      event.preventDefault();
      const prevEmojiItem = event.currentTarget.previousElementSibling as HTMLElement;
      if (prevEmojiItem) {
        prevEmojiItem.focus();
      }
    }
  };

  return (
    <div className="chat-input-container">
       {emojiPopupVisible && (
        <div
          className="emoji-popup"
          ref={emojiPopupRef}
          onKeyDown={handleEmojiPopupKeyDown}
          tabIndex={0} // Ensure the popup can receive focus
        >
          {Object.entries(filteredEmojis).map(([name, emoji]) => (
            <div
              key={name}
              className="emoji-item"
              data-name={name}
              tabIndex={0} // Make each emoji item focusable
              onClick={() => handleEmojiSelect(`:${name}:`)}
            >
              {emoji} :{name}:
            </div>
          ))}
        </div>
      )}
      <div className={`chat-input !${emojiPopupVisible && "rounded-[0px]"}`}>
        <div className="chat-input-left">
          <FaPlus className="w-6 h-6" />
        </div>
        <div
          ref={inputRef}
          className="chat-input-middle"
          contentEditable={true}
          suppressContentEditableWarning
          {...{ placeholder }}
          id="textbox"
          role="textbox"
          onKeyDown={async (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (content.length < 1) return;
              await room.send({ content });
              setContent("");
              setCharacterCount(0);
              setCurrentlyTyping(false);
              setEmojiPopupVisible(false);
              (event.target as HTMLElement).innerText = "";
            }
          }}
          onInput={(event) => {
            if ((event.target as HTMLDivElement).innerText.trim() === "") {
              handleClearContent();
            }
          }}
          onPaste={handlePaste}
        />
        <div className="chat-input-right">
          <FaFaceSmile className="w-6 h-6" />
        </div>
      </div>
      <span className="typing">
        {typingUsers.length > 0 && (
          <>
            <div className="avatars">
              {typingUsers.slice(0, 4).map((user, index) => (
                <img
                  key={user.id}
                  src={Formatting.formatAvatar(user?.id, user?.avatar)}
                  alt={user.displayName}
                  className={`avatar avatar-${index}`}
                />
              ))}
              {typingUsers.length > 4 && (
                <span className="more-avatars">...</span>
              )}
            </div>
            <span className="user-names">
              {typingUsers.length > 4
                ? " Several people are typing"
                : typingUsers.map((user, index) => (
                    <React.Fragment key={user.id}>
                      {index > 0 && ", "}
                      {(typingUsers.length === 2 || typingUsers.length === 3) &&
                        index === typingUsers.length - 1 &&
                        " and "}
                      <b>{user.displayName}</b>
                    </React.Fragment>
                  ))}
            </span>
            {typingUsers.length <= 4 && typingUsers.length > 1
              ? " are typing"
              : typingUsers.length === 1
              ? " is typing"
              : ""}
            <span className="typing-indicator"></span>
          </>
        )}
      </span>
    </div>
  );
}
