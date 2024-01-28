"use client";
import { useEffect, useRef } from "react";

export function ChatInput({ placeholder }: { placeholder: string }) {

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
    }, [ref.current]);

    return (
        <div className="chat-input-container">
            <div className="chat-input" style={{ height: `${ref?.current?.scrollHeight}` }}>
                <div className="chat-input-left"></div>
                <div ref={ref} className="chat-input-middle" contentEditable={true} suppressContentEditableWarning {...{ placeholder }} />
                <div className="chat-input-right"></div>
            </div>
        </div>
    )
}