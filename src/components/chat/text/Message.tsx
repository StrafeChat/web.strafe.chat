import { MessageProps } from "@/types";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import { emojis } from "@/assets/emojjs";
import { MessageEmbed } from './MessageEmbed';
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
import { Invite, User } from "@strafechat/strafe.js";
import { ContextMenuTrigger, ContextMenu, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { Formatting } from "@/helpers/formatter";
import { InviteEmbed } from "./InviteEmbed";
import { fetchMetadata, Metadata } from "@/utils";

export function Message({ message, key, sameAuthor, showMoreOptions, ghost }: MessageProps) {
  const contentRef = useRef<HTMLSpanElement>(null);

  const replyRef = useRef<HTMLSpanElement>(null);
  const [editable, setEditable] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<Invite | null | undefined>(null);
  const [metadataDetails, setMetadataDetails] = useState<Metadata | null>(null)
  const metadataFetched = useRef(false);
  const { client } = useClient();
  ghost ||= false;

  
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
        className: "w-5 h-5",
      });
    }
  }, []);

  function extractInviteCode(url: string) {
    const regex = /(?:https?:\/\/)?(?:localhost:\d+)?\/invites\/([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
        return match[1]; 
    } else {
        return null;
    }
}

  function formatTimestamp(timestamp: number) {
    const now = DateTime.now();
    const date = DateTime.fromMillis(timestamp);

    switch (true) {
      case date.hasSame(now, 'day'):
        return `Today at ${date.setLocale(client?.user?.locale!).toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.plus({ days: 1 }).hasSame(now, 'day'):
        return `Yesterday at ${date.setLocale(client?.user?.locale!).toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.hasSame(now, 'week'):
        return "Last " + date.setLocale(client?.user?.locale!).toFormat('EEEE') + ` at ${date.setLocale(client?.user?.locale!).toLocaleString(DateTime.TIME_SIMPLE)}`;
      default:
        return date.setLocale(client?.user?.locale!).toLocaleString(DateTime.DATETIME_SHORT);
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
      
    let text = content;
    const inviteCode = extractInviteCode(text)
    
    if (text && inviteCode) {
      client?.invites.fetch(inviteCode) .then((invite) => {
        setInviteDetails(invite);
    
      })
      .catch((error) => {
        console.error("Error fetching invite details:", error);
      });
    }

    const urlRegex = /https?:\/\/\S+|www\.\S+/;
    const inviteRegex = /(?:https?:\/\/)?(?:localhost:\d+)?\/invites\/([a-zA-Z0-9]+)/;

    if (text && urlRegex.test(text) && !inviteRegex.test(text)) {
      if (!metadataFetched.current) {
        const matches = text.match(urlRegex);
        fetchMetadata(matches![0], (metadata) => {
          if (metadata) {
            setMetadataDetails(metadata);
            metadataFetched.current = true;
          }
        });
      }
    };

    const patterns: Record<
      string,
      (match: string, ...groups: string[]) => string
    > = {
      ":([^:]+):": (match, content) => {
        const emojiValue = emojis[content];
        return emojiValue ?? match;
      },
    };
  
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
        <ContextMenu>
          <ContextMenuTrigger>
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
          <ProfilePopup user={message.author} client>
            <img
                 src={`${message.sudo ? message.sudo.avatar_url : `${Formatting.formatAvatar(message?.author.id, message?.author.avatar)}`}`}
                 className="avatar"
                 draggable={false}
                 alt="Avatar"
      />
      </ProfilePopup>
      </div>
      <div className="flex flex-col w-full">
      <span className="username">
       <ProfilePopup user={message.author} client>
        <p>
          {message.sudo ? message.sudo.name! : message.author.display_name!}
          {message.sudo && <span className="bot-tag">SUDO</span>}
          {message.author.bot && !message.sudo && <span className="bot-tag">BOT</span>}
        </p>
      </ProfilePopup>
      <span className="timestamp">{formatTimestamp(message.createdAt)}</span>
      </span>
        <span className={`content inline-flex ${editable && "message-edtitable full"} ${(inviteDetails || message.embeds) ? "flex-col" : ""}`} ref={contentRef} contentEditable={editable} onKeyDown={(event) => handleInput(event)}>
         {message.content && (
            <>
            <ReactMarkdown
            components={{ a: CustomLink }}
            remarkPlugins={[gfm, remarkMath, remarkFrontmatter, remarkParse]}
          > 
            {transformMessage(message.content as string)}
          </ReactMarkdown> 
          </>
         )}   
        </span>
        <span className="ml-[15px] pr-[20px]">
        {message.embeds && message.embeds.map((embed, index) => (
               <MessageEmbed key={index} embed={embed} />
            ))}
            {metadataDetails && <MessageEmbed embed={{
              title: metadataDetails.title,
              description: metadataDetails.description,
              color: "#ff9966"
            }} />}

          {inviteDetails && (
             <InviteEmbed
                   key={`invite-${inviteDetails.code}`}
                   invite={inviteDetails}
                   client={client!}
             />
          )}
          {message.editedAt && !editable && (<span className="edited pt-[3px]">(edited)</span>)}
          </span>
      </div>
      </li>
      </ContextMenuTrigger>
       <ContextMenuContent>
       {/* <ContextMenuItem onClick={() => openModal("settings")} className="flex gap-2 items-center"><FaGear className="w-3 h-3 rounded-full" /> Settings</ContextMenuItem>
       <hr />
       <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "online" })}><div className="user-status online" /> Online</ContextMenuItem>
       <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "idle" })}><div className="user-status idle" />Idle</ContextMenuItem>
       <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "coding" })}><div className="user-status coding" />Coding</ContextMenuItem>
       <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "dnd" })}><div className="user-status dnd" />Do Not Disturb</ContextMenuItem>
       <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "offline" })}><div className="user-status offline" />Invisible</ContextMenuItem>
       <hr />
       <ContextMenuItem onClick={() => openModal("status")}><FaPenToSquare className="w-3 h-3" /> Custom Status</ContextMenuItem> */}
    </ContextMenuContent>
 </ContextMenu>
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
          <div className="flex flex-col w-full">
          <span className="timestamp absolute text-center text-[11px] pt-2.5 px-3">{ isHovered && messageDate.toLocaleString(DateTime.TIME_SIMPLE)}</span>
            <span className={`content pl-[60px] select-text inline-flex ${editable && "message-edtitable notfull"} ${(inviteDetails || message.embeds) ? "flex-col" : ""}`} ref={contentRef}  style={{ minHeight: editable ? "4vh" : "fit-content" }} contentEditable={editable} onKeyDown={(event) => handleInput(event)}>
             {message.content && (
               <>
               <ReactMarkdown
                components={{ a: CustomLink }}
                remarkPlugins={[gfm, remarkMath, remarkFrontmatter, remarkParse]}
              >
                {transformMessage(message.content!)}
              </ReactMarkdown>
              </>
             )}             
              {message.embeds && message.embeds.map((embed, index) => (
               <MessageEmbed key={index} embed={embed} />
            ))}
             {metadataDetails && <MessageEmbed embed={{
              title: metadataDetails.title,
              description: metadataDetails.description,
              color: "#ff9966"
            }} />}
            {inviteDetails && (
             <InviteEmbed
                   key={`invite-${inviteDetails.code}`}
                   invite={inviteDetails}
                   client={client!}
             />
          )}
              {message.editedAt && !editable && (<span className="edited pt-[2px]">(edited)</span>)}
            </span>
          </div>
    </li>
     )} 
   </>
  );
}

