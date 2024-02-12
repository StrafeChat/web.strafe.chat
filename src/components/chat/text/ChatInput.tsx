"use client";
import { Room } from "@strafechat/strafe.js";
import cookie from "js-cookie";
import { useEffect, useRef, useState, useCallback } from "react";

export function ChatInput({ placeholder, room }: { placeholder: string, room: Room },) {

    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const [content, setContent] = useState("");

    useEffect(() => {
    }, [ref.current]);

    const handleInput = useCallback((event: Event) => {
        if (inputRef.current) {
          const text = inputRef.current.innerHTML;
          setContent(inputRef.current.innerText);
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
        <div className="chat-input-container">
            <div className="chat-input" style={{ height: `${ref?.current?.scrollHeight}` }}>
                <div className="chat-input-left"></div>
                <div ref={inputRef} className="chat-input-middle" contentEditable={true} suppressContentEditableWarning {...{ placeholder }} 
                id="textbox"
                role={"textbox"}
                onKeyDown={async (event) => {
                if (event.key == "Enter" && !event.shiftKey) {
                event.preventDefault();
                await fetch(
                  `${process.env.NEXT_PUBLIC_API}/rooms/${room.id}/messages`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: cookie.get("token")!,
                    },
                    body: JSON.stringify({
                      content,
                    }),
                  }
                );
                setContent("");
                (event.target as HTMLElement).innerText = "";
              }
            }} 
            />
                <div className="chat-input-right"></div>
            </div>
        </div>
    )
}