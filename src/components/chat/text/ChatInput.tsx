import { Room } from "@strafechat/strafe.js";
import { useEffect, useRef, useState, useCallback } from "react";

export function ChatInput({ placeholder, room }: { placeholder: string, room: Room }) {

  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const maxCharacters = 2000; // Set your desired maximum character count
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
  }, []);

  const handleInput = useCallback((event: Event) => {
    if (inputRef.current) {
      const text = inputRef.current.innerText;
      setContent(text);
      setCharacterCount(text.length);
    }
  }, []);

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
              (event.target as HTMLElement).innerText = "";
            }
          }}
        />
        <div className="chat-input-right">{characterCount}/{maxCharacters}</div>
      </div>
      {/* <span className="typing"><b>(global_name)</b> is typing...</span> */}
    </div>
  </>
  
  )
}