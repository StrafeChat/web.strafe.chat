import { useAuth } from "@/context/AuthContext";
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
  Dispatch,
  RefObject,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactTimeago from "react-timeago";
import cookie from "js-cookie";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { emojis } from "@/assets/emojis";
import { Formatting } from "@/scripts/Formatting";
import twemoji from "twemoji";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import Badges from "../Badges";
import ProfilePopup from "../popup/ProfilePopup";

export default function Message({
  message,
  messages,
  sameAuthor,
  showMoreOptions,
  setReferenceMessage,
}: {
  message: any;
  messages: any[];
  sameAuthor: boolean;
  showMoreOptions: boolean;
  setReferenceMessage: Dispatch<SetStateAction<any | null>>;
}) {
  const { user } = useAuth();
  const contentRef = useRef<HTMLSpanElement>(null);
  const replyRef = useRef<HTMLSpanElement>(null);
  const [editable, setEditable] = useState(false);

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

    if (replyRef.current) {
      twemoji.parse(replyRef.current, {
        folder: "svg",
        ext: ".svg",
        className: "w-5 h-5",
      });
    }
  }, [message.content]);

  const handleInput = async (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key == "Escape") {
      contentRef.current?.blur();
      setEditable(false);
      if (contentRef.current) contentRef.current.innerText = message.content;
    } else if (event.key == "Enter" && !event.shiftKey) {
      event.preventDefault();
      contentRef.current?.blur();
      setEditable(false);

      await fetch(
        `${process.env.NEXT_PUBLIC_API}/rooms/${message.room_id}/messages/${message.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: cookie.get("token")!,
          },
          body: JSON.stringify({
            content: contentRef.current!.innerText,
          }),
        }
      );
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

  return (
    <li id={`message-${message.id}`} className="group message pb-[5px]">
      {!editable && (
        <div className="options group-hover:flex">
          <div className="icon">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="icon">
                    <FontAwesomeIcon
                      icon={faReply}
                      onClick={() => setReferenceMessage(message)}
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
          {user.id == message.author_id && (
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
                            await fetch(
                              `${process.env.NEXT_PUBLIC_API}/rooms/${message.room_id}/messages/${message.id}`,
                              {
                                method: "DELETE",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: cookie.get("token")!,
                                },
                              }
                            );
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
      )}
      {message.message_reference_id && (
        <div className="min-w-fit w-full px-8 flex relative pt-4">
          <div className="w-[2rem] h-[0.75rem] border-l-2 border-t-2 border-gray-500 rounded-tl-[0.5rem]" />
          {(() => {
            const currentMessage = messages.find(
              (msg) => msg.id == message.message_reference_id
            );
            return (
              <span
                className="absolute top-0 left-[4.50rem] text-sm flex w-fit cursor-pointer"
                onClick={() => {
                  const section = document.querySelector(
                    `#message-${message.message_reference_id}`
                  );
                  section?.scrollIntoView({ behavior: "smooth", block: "end" });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={Formatting.avatar(
                    currentMessage.author.id,
                    currentMessage.author.avatar
                  )}
                  style={{ objectFit: "cover" }}
                  className="avatar mr-2 w-[16px] h-[16px] mt-2"
                  draggable={false}
                  width={16}
                  height={16}
                  alt=""
                />
                <span className="font-bold text-white pt-1.5 mr-2 flex">
                  {currentMessage.author.username}
                </span>
                <span ref={replyRef} className="text-gray-400 pt-1.5">
                  {transformMessage(currentMessage.content)}
                </span>
              </span>
            );
          })()}
        </div>
      )}
      <div
        className={`message-wrapper ${!sameAuthor && "same-author"} ${
          message.message_reference_id && "replied"
        }`}
      >
        <div className="author-container">
          {!sameAuthor || message.message_reference_id ? (
            <ProfilePopup user={message.author}>
              <div className="author-wrapper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={Formatting.avatar(
                    message.author.id,
                    message.author.avatar
                  )}
                  style={{ objectFit: "cover" }}
                  className="avatar"
                  draggable={false}
                  width={40}
                  height={40}
                  alt=""
                />
              </div>
            </ProfilePopup>
          ) : (
            <time className="group-hover:!opacity-100">
              {Intl.DateTimeFormat(message.author.locale, {
                hour: "numeric",
                minute: "numeric",
                hour12: false,
              }).format(new Date(message.created_at))}
            </time>
          )}
        </div>
        <div className="content-container">
          {(!sameAuthor || message.message_reference_id) && (
            <span className="info">
              <ProfilePopup user={message.author}>
                <span className="username">
                  {message.author.global_name ?? message.author.username}
                </span>
              </ProfilePopup>
              <ReactTimeago date={message.created_at} />
            </span>
          )}
          <span
            style={{ maxHeight: editable ? "50vh" : "fit-content" }}
            ref={contentRef}
            contentEditable={editable}
            onKeyDown={(event) => handleInput(event)}
            className={`text-white select-text inline-flex ${editable && "message-edtitable"}`}
          >
            <ReactMarkdown
              components={{
                a: CustomLink,
              }}
              remarkPlugins={[gfm]}
            >
              {transformMessage(message.content)}
            </ReactMarkdown>
            {message.edited_at && !editable && (<span className="edited">(edited)</span>)}
          </span>
        </div>
      </div>
    </li>
  );
}
