import { MessageProps } from "@/types";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import { emojis } from "@/assets/emojjs";
import twemoji from "twemoji";
import { DateTime } from 'luxon';
import {
  useEffect,
  useRef,
  useState,
} from "react";
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import ProfilePopup from "../../popup/ProfilePopup";
import remarkParse from 'remark-parse';
import { useClient } from '@/hooks'
import {
  faFaceSmile,
  faInfoCircle,
  faLink,
  faPen,
  faReply,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";

export function Message({ message, key, sameAuthor, showMoreOptions }: MessageProps) {
  const contentRef = useRef<HTMLSpanElement>(null);
  const replyRef = useRef<HTMLSpanElement>(null);
  const [editable, setEditable] = useState(false);
  const { client } = useClient();

  useEffect(() => {
    if (contentRef.current) {
      twemoji.parse(contentRef.current, {
        folder: "svg",
        ext: ".svg",
        className: "w-7 h-7",
      });
    }
  }, []);

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

  const transformMessage = (content: string) => {
    const patterns: Record<
      string,
      (match: string, ...groups: string[]) => string
    > = {
      ":([^:]+):": (match, content) => {
        const emojiValue = emojis[content];
        return emojiValue ?? match;
      },
    };

    let text = content;

    for (const pattern in patterns) {
      const regex = new RegExp(pattern, "g");
      text = text.replace(regex, patterns[pattern]);
    }

    return text;
  };

  return (
    <>
      {!sameAuthor ? (
        <li key={key} className="group message full">
             <div className="options group-hover:flex">
          <div className="icon">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="icon">
                    <FontAwesomeIcon
                      icon={faReply}
                      // onClick={() => setReferenceMessage(message)}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Reply</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="icon">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="icon">
                    <FontAwesomeIcon icon={faFaceSmile} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Add Reaction</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {client?.user!.id == message.authorId && (
            <>
              <div className="icon">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="icon">
                        <FontAwesomeIcon
                          onClick={() => setEditable(true)}
                          icon={faPen}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Edit Message</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="icon">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="icon">
                        <FontAwesomeIcon
                          className="danger"
                          icon={faTrashCan}
                          onClick={async () => {
                            // await fetch(
                            //   `${process.env.NEXT_PUBLIC_API}/rooms/${message.roomId}/messages/${message.id}`,
                            //   {
                            //     method: "DELETE",
                            //     headers: {
                            //       "Content-Type": "application/json",
                            //       Authorization: cookie.get("token")!,
                            //     },
                            //   }
                            // );
                          }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Delete Message</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          )}
          {showMoreOptions && (
            <>
              <span className="icon">
                <FontAwesomeIcon icon={faInfoCircle} />
              </span>
              <span className="icon">
                <FontAwesomeIcon icon={faLink} />
              </span>
            </>
          )}
          </div>
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
          <span className="timestamp">{formatTimestamp(message.createdAt)}</span>
        </span>
        <span className="content" ref={contentRef}>
          <ReactMarkdown
            components={{ a: CustomLink }}
            remarkPlugins={[gfm, remarkMath, remarkFrontmatter, remarkParse]}
          >
            {transformMessage(message.content!)}
          </ReactMarkdown>
        </span>
      </div>
      </li>
     ): (      
    <li key={key} className="group message">
                   <div className="options group-hover:flex">
          <div className="icon">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="icon">
                    <FontAwesomeIcon
                      icon={faReply}
                      // onClick={() => setReferenceMessage(message)}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Reply</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="icon">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="icon">
                    <FontAwesomeIcon icon={faFaceSmile} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Add Reaction</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {client?.user!.id == message.authorId && (
            <>
              <div className="icon">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="icon">
                        <FontAwesomeIcon
                          onClick={() => setEditable(true)}
                          icon={faPen}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Edit Message</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="icon">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="icon">
                        <FontAwesomeIcon
                          className="danger"
                          icon={faTrashCan}
                          onClick={async () => {
                            // await fetch(
                            //   `${process.env.NEXT_PUBLIC_API}/rooms/${message.roomId}/messages/${message.id}`,
                            //   {
                            //     method: "DELETE",
                            //     headers: {
                            //       "Content-Type": "application/json",
                            //       Authorization: cookie.get("token")!,
                            //     },
                            //   }
                            // );
                          }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Delete Message</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          )}
          {showMoreOptions && (
            <>
              <span className="icon">
                <FontAwesomeIcon icon={faInfoCircle} />
              </span>
              <span className="icon">
                <FontAwesomeIcon icon={faLink} />
              </span>
            </>
          )}
          </div>
     <div className="flex flex-col">
      <span className="content pl-[48px]" ref={contentRef}>
      <ReactMarkdown
        components={{ a: CustomLink }}
        remarkPlugins={[gfm, remarkMath, remarkFrontmatter, remarkParse]}
      >
        {transformMessage(message.content!)}
      </ReactMarkdown>
    </span>
    </div>
    </li>
     )} 
   </>
  );
}
