import { MessageProps } from "@/types";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import { DateTime } from 'luxon';

export function Message({ message }: MessageProps) {
    function formatTimestamp(timestamp: number) {
        const now = DateTime.now();
        const date = DateTime.fromMillis(timestamp);
    
        switch (true) {
          case date.hasSame(now, 'day'):
            return `Today at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
          case date.plus({ days: 1 }).hasSame(now, 'day'):
            return `Yesterday at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
          case date.hasSame(now, 'week'):
            return date.toFormat('EEEE') + ` at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
          default:
            return date.toLocaleString(DateTime.DATETIME_SHORT);
        }
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
                    components={{ a: CustomLink, }} remarkPlugins={[gfm]}>
                    {message.content}
                  </ReactMarkdown>
               </span>
            </div>
         </li>
      )
  }