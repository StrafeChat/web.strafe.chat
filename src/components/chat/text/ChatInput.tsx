import { Room } from "@strafechat/strafe.js";
import { useEffect, useRef, useState, useCallback, ClipboardEventHandler } from "react";
import { useClient } from "@/hooks";
import { FaFaceSmile, FaPlus } from "react-icons/fa6";
import { emojis } from "@/assets/emojis";
import twemoji from "twemoji";
import React from "react";

export function ChatInput({ placeholder, room }: { placeholder: string, room: Room }) {
  const { client } = useClient();
  const inputRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const maxCharacters = 2000;
  const [characterCount, setCharacterCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<{ id: string, displayName: string }[]>([]);
  const [currentlyTyping, setCurrentlyTyping] = useState<boolean>(false);
  const [emojiPopupVisible, setEmojiPopupVisible] = useState(false);
  const [filteredEmojis, setFilteredEmojis] = useState<{ [key: string]: string }>({});
  const [emojiSearch, setEmojiSearch] = useState("");

  useEffect(() => {
    let typingTimeout: NodeJS.Timeout;

    const handleTypingStart = (data: any) => {
      if (data.room_id !== room.id) return;
      const { id, global_name, username } = data.user;
      const displayName = global_name || username;
      if (id === client?.user?.id) return;
      setTypingUsers(prevUsers => {
        if (!prevUsers.some(user => user.id === id)) {
          return [...prevUsers, { id, displayName }];
        }
        return prevUsers;
      });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        setTypingUsers(prevUsers => prevUsers.filter(user => user.id !== id));
      }, 10000);
    };

    const handleMessageCreate = (message: any) => {
      setTypingUsers(prevUsers => prevUsers.filter(user => user.id !== message.author.id));
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
            Object.entries(emojis).filter(([name]) =>
              name.startsWith(search)
            )
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
      document.execCommand('insertText', false, text);
    } catch (error) {
      console.error('Failed to read text from clipboard:', error);
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
      const popup = document.querySelector(".emoji-popup") as HTMLElement;
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
      setEmojiPopupVisible(false);
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

  return (
    <div className="chat-input-container">
      {emojiPopupVisible && (
        <div className="emoji-popup">
          {Object.entries(filteredEmojis).map(([name, emoji]) => (
            <div
              key={name}
              className="emoji-item"
              onClick={() => handleEmojiSelect(`:${name}:`)}
            >
              {emoji} :{name}:
            </div>
          ))}
        </div>
      )}
      <div className={`chat-input !${emojiPopupVisible && "rounded-[0px]"}`}>
        <div className="chat-input-left"><FaPlus className="w-6 h-6" /></div>
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
        <div className="chat-input-right"><FaFaceSmile className="w-6 h-6" /></div>
      </div>
      <span className="typing">
        {typingUsers.length > 0 && (
          <>
            {typingUsers.length > 4
              ? "Several people are typing"
              : typingUsers.map((user, index) => (
                  <React.Fragment key={user.id}>
                    {index > 0 && ', '}
                    {typingUsers.length === 3 && index === typingUsers.length - 2 && ' and '}
                    <b>{user.displayName}</b>
                  </React.Fragment>
                ))}
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
