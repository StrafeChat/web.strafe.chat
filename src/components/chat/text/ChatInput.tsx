import { Room } from "@strafechat/strafe.js";
import { useEffect, useRef, useState, useCallback } from "react";
import { useClient } from "@/hooks";

export function ChatInput({ placeholder, room }: { placeholder: string, room: Room }) {

  const { client } = useClient();
  const inputRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const maxCharacters = 2000;
  const [characterCount, setCharacterCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentlyTyping, setCurrentlyTyping] = useState<boolean>(false);
 
  useEffect(() => {
    let typingTimeout: NodeJS.Timeout;

    const handleTypingStart = (data: any) => {
      if (data.room_id !== room.id) return;
      const { global_name, username } = data.user;
      const name = global_name || username;
      if (data.user.id == client?.user?.id) return;
      setTypingUsers(prevUsers => {
        if (!prevUsers.includes(name)) {
          return [...prevUsers, name];
        }
        return prevUsers;
      });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        setTypingUsers(prevUsers => prevUsers.filter(userName => userName !== name));
      }, 10000);
    };

    client?.on("typingStart", handleTypingStart);
    client?.on("messageCreate", (message) => {
        setTypingUsers(prevUsers => prevUsers.filter(userName => userName !== message.author.global_name ?? message.author.username))
  })

    return () => {
      client?.off("typingStart", handleTypingStart);
      client?.off("messageCreate", (message) => {
          setTypingUsers(prevUsers => prevUsers.filter(userName => userName !== message.author.global_name ?? message.author.username));
      })
      clearTimeout(typingTimeout);
    };
  }, [client]);

  const handleInput = useCallback(async () => {
    if (inputRef.current) {
      const text = inputRef.current.innerText;
      setContent(text);
      setCharacterCount(text.length);
      if (!currentlyTyping) {
        setCurrentlyTyping(true);
        await room.sendTyping();
        setTimeout(() => {
          setCurrentlyTyping(false);
        }, 10000)
      }
    }
  }, [room, currentlyTyping]);

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

  return (
    <>
    <div className="chat-input-container">
      <div className="chat-input">
        <div className="chat-input-left"></div>
        <div
          ref={inputRef}
          className="chat-input-middle"
          contentEditable={true}
          suppressContentEditableWarning
          {...{ placeholder }}
          id="textbox"
          role={"textbox"}
          onKeyDown={async (event) => {
            if (event.key == "Enter" && !event.shiftKey) {
              event.preventDefault();
              
              await room.send({ content });
              setContent("");
              setCharacterCount(0);
              setCurrentlyTyping(false);
              (event.target as HTMLElement).innerText = "";
            }
          }}
        />
        <div className="chat-input-right">{characterCount}/{maxCharacters}</div>
      </div>
        <span className="typing">
        {typingUsers.length > 0 && (
          <>
          {typingUsers.length > 4 ? "Several people are typing..." : typingUsers.map((userName, index) => (
            <>{index > 0 && ', '}{typingUsers.length === 3 && index === typingUsers.length - 1 && ' and '}<b>{userName}</b></>
          ))}
          {typingUsers.length <= 4 && typingUsers.length > 1 ? " are typing..." : typingUsers.length === 1 ? " is typing..." : ""}
          </>
         )}
      </span>
    </div>
  </>
  
  )
}
