import { IMessage, Room } from "@strafechat/strafe.js";
import ReactMarkdown from "react-markdown";
import { useRef, useEffect } from "react";
import gfm from "remark-gfm";
import { DateTime } from 'luxon';

export default function ChatBody(props: { room: Room }) {
   const room = props.room;
   const scrollRef = useRef<HTMLUListElement>(null);

    function formatTimestamp(timestamp: any) {
        const now = DateTime.now();
        const date = DateTime.fromMillis(timestamp);
    
        if (date.hasSame(now, 'day')) {
            return `Today at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
        }

        if (date.plus({ days: 1 }).hasSame(now, 'day')) {
            return `Yesterday at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
        }
    
        if (date.hasSame(now, 'week')) {
            return date.toFormat('EEEE') + ` at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
        }
    
        return date.toLocaleString(DateTime.DATETIME_SHORT);
    }

    const CustomLink = ({ href, children }: { href?: any; children?: any }) => (
        <a
          href={href}
          className="text-blue-500 hover:underline hover:text-blue-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );

    return (
        <div className="body">
           <ul 
           ref={scrollRef}
           className="messages flex min-w-[5px] overflow-scroll h-full flex-col justify-end pt-[25px]"
           >
           <div className="pb-6">
              <h1 className="text-2xl font-bold inline-flex items-center">
                  Welcome to #{room.name}
              </h1>
              <p className="text-base">
                This is the start of the room. {room.topic ? room.topic : "" }
              </p>
            </div>
            <hr className="pb-3 opacity-40"/>
                {
                  room?.messages?.toArray().map((message: IMessage, key) => (
                    <li key={message.id} className="message">
                      <img
                      src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${message.author.id}/${message.author.avatar}`}
                      style={{ objectFit: "cover" }}
                      className="avatar"
                      draggable={false}
                      width={40}
                      height={40}
                      alt=""
                    />
                    <div className="flex flex-col">
                     <span className="username">
                      {message.author.global_name ?? message.author.username} 
                     <span className="timestamp">{formatTimestamp(message.created_at)}</span>
                     </span>
                     <span className="content">
                      <ReactMarkdown
                        components={{ a: CustomLink, }}remarkPlugins={[gfm]}>
                        {message.content}
                      </ReactMarkdown>
                     </span>
                    </div>
                   </li>
                  ))
               }
           </ul>
        </div>
    )
}