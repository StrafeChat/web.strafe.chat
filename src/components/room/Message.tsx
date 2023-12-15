import { useAuth } from "@/context/AuthContext";
import {
  faEllipsisVertical,
  faFaceSmile,
  faInfo,
  faInfoCircle,
  faLink,
  faPen,
  faReply,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ContextMenu, ContextMenuTrigger } from "@radix-ui/react-context-menu";
import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactTimeago, { contextType } from "react-timeago";

export default function Message({
  message,
  sameAuthor,
  showMoreOptions,
}: {
  message: any;
  sameAuthor: boolean;
  showMoreOptions: boolean;
}) {
  const { user } = useAuth();
  const contentRef = useRef<HTMLSpanElement>(null);
  const [editable, setEditable] = useState(false);

  useEffect(() => {
    if (editable && contentRef.current) {
      contentRef.current.focus();
    }
  }, [editable]);

  const handleInput = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key == "Escape") {
      contentRef.current?.blur();
      setEditable(false);
      if (contentRef.current) contentRef.current.innerText = message.content;
    } else if(event.key == "Enter" && !event.shiftKey) {
      event.preventDefault();
      contentRef.current?.blur();
      setEditable(false);
    }
  };

  return (
    <li id={message.id} className="group hover:bg-[rgba(0,0,0,0.1)]">
      <div className="hidden group-hover:flex absolute bg-black text-white right-5 -translate-y-5 rounded-lg">
        <div style={{ borderColor: "transparent" }} className="flex">
          <span className="w-8 h-8 flex items-center">
            <FontAwesomeIcon className="p-2" icon={faReply} />
          </span>
          <span className="w-8 h-8 flex items-center">
            <FontAwesomeIcon className="p-2" icon={faFaceSmile} />
          </span>
          {user.id == message.author_id && (
            <>
              <span
                className="w-8 h-8 flex items-center"
                onClick={() => setEditable(true)}
              >
                <FontAwesomeIcon className="p-2" icon={faPen} />
              </span>
              <span className="w-8 h-8 flex items-center">
                <FontAwesomeIcon
                  className="p-2 text-red-500"
                  icon={faTrashCan}
                />
              </span>
            </>
          )}
          <span className="w-8 h-8 flex items-center">
            <FontAwesomeIcon className="p-2" icon={faEllipsisVertical} />
          </span>
        </div>
        {showMoreOptions && (
          <div className="flex items-center">
            <span className="w-8 h-8 flex items-center">
              <FontAwesomeIcon className="p-2" icon={faInfoCircle} />
            </span>
            <span className="w-8 h-8 flex items-center">
              <FontAwesomeIcon className="p-2" icon={faLink} />
            </span>
          </div>
        )}
      </div>
      <div className={`flex p-0.5 pe-4 ${!sameAuthor && "mt-3"}`}>
        <div className="w-[62px] flex flex-shrink-0 pt-0.5 justify-center">
          {!sameAuthor ? (
            <div className="rounded-full overflow-hidden w-10 h-10 duration-200 active:translate-y-0.5 cursor-pointer">
              <Image
                src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${message.author.avatar}.png`}
                width={40}
                height={40}
                alt=""
              />
            </div>
          ) : (
            <time className="text-sm invisible group-hover:visible text-gray-500 font-bold">
              {Intl.DateTimeFormat(message.author.locale, {
                hour: "numeric",
                minute: "numeric",
                hour12: false,
              }).format(new Date(message.created_at))}
            </time>
          )}
        </div>
        <div className="relative min-w-0 flex-grow flex flex-col justify-center text-sm">
          {!sameAuthor && (
            <span className="gap-2 flex items-center flex-shrink-0">
              <span className="text-white overflow-hidden cursor-pointer text-ellipsis whitespace-normal font-bold">
                {message.author.global_name ?? message.author.username}
              </span>
              <ReactTimeago
                date={message.created_at}
                className="flex-shrink-0 gap-1 text-xs text-gray-500"
              />
            </span>
          )}
          <span
          style={{maxHeight: editable ? "50vh" : "fit-content"}}
            ref={contentRef}
            contentEditable={editable}
            onKeyDown={(event) => handleInput(event)}
            className={`text-white ${editable && "p-2 bg-black rounded-xl overflow-y-auto"}`}
          >
            {message.content}
          </span>
        </div>
      </div>
    </li>
  );
}
