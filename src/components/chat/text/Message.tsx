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
import { User } from "@strafechat/strafe.js";

export function Message({ message, key, sameAuthor, showMoreOptions }: MessageProps) {
  const contentRef = useRef<HTMLSpanElement>(null);
  const replyRef = useRef<HTMLSpanElement>(null);
  const [editable, setEditable] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { client } = useClient();

  
  useEffect(() => {
    if (editable && contentRef.current) {
      contentRef.current.focus();
    }
  }, [editable]);

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
        return "Last " + date.toFormat('EEEE') + ` at ${date.toLocaleString(DateTime.TIME_SIMPLE)}`;
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

  const handleInput = async (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key == "Escape") {
      contentRef.current?.blur();
      setEditable(false);
    } else if (event.key == "Enter" && !event.shiftKey) {
      event.preventDefault();
      contentRef.current?.blur();
      setEditable(false);

     await message.edit({ content: contentRef.current?.innerText });
    }
  };


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

  const messageDate = DateTime.fromMillis(message.createdAt);

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
          {client?.user!.id == message.author.id && (
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
                    <TooltipContent>Edit</TooltipContent>
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
                            await message.delete();
                          }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
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
          <ProfilePopup user={message.author}>
            <img
                 src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${message.author.id}/${message.author.avatar}`}
                 className="avatar"
                 draggable={false}
                 alt="Avatar"
      />
      </ProfilePopup>
      </div>
      <div className="flex flex-col">
        <span className="username">
        <ProfilePopup user={message.author}>
          <p>{message.author.display_name!}</p>
          </ProfilePopup>
          <span className="timestamp">{formatTimestamp(message.createdAt)}</span>
        </span>
        <span className={`content inline-flex ${editable && "message-edtitable"}`} ref={contentRef} contentEditable={editable} onKeyDown={(event) => handleInput(event)}>
          <ReactMarkdown
            components={{ a: CustomLink }}
            remarkPlugins={[gfm, remarkMath, remarkFrontmatter, remarkParse]}
          >
            {transformMessage(message.content!)}
          </ReactMarkdown>
          {message.editedAt && !editable && (<span className="edited pt-[3px]">(edited)</span>)}
        </span>
      </div>
      </li>
     ): (      
    <li key={key} className="group message" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
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
          {client?.user!.id == message.author.id && (
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
                    <TooltipContent>Edit</TooltipContent>
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
                            await message.delete();
                          }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
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
          <div className="relative">
          <div className="flex flex-col">
          <span className="timestamp absolute text-center text-[11px] pt-2.5 px-3">{ isHovered && messageDate.toLocaleString(DateTime.TIME_SIMPLE)}</span>
            <span className={`content pl-[60px] ml-[60px] select-text inline-flex ${editable && "message-edtitable"}`} ref={contentRef}  style={{ minHeight: editable ? "4vh" : "fit-content" }} contentEditable={editable} onKeyDown={(event) => handleInput(event)}>
              <ReactMarkdown
                components={{ a: CustomLink }}
                remarkPlugins={[gfm, remarkMath, remarkFrontmatter, remarkParse]}
              >
                {transformMessage(message.content!)}
              </ReactMarkdown>
              {message.editedAt && !editable && (<span className="edited pt-[2px]">(edited)</span>)}
            </span>
          </div>
        </div>
    </li>
     )} 
   </>
  );
}
