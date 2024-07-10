import { MessageProps } from "@/types";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import { emojis } from "@/assets/emojis";
import { MessageEmbed } from "./MessageEmbed";
import twemoji from "twemoji";
import { DateTime } from "luxon";
import { useEffect, useRef, useState } from "react";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";
import ProfilePopup from "../../../popup/ProfilePopup";
import remarkParse from "remark-parse";
import { useClient, useModal } from "@/hooks";
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
} from "../../../ui/tooltip";
import { Invite, User } from "@strafechat/strafe.js";
import {
  ContextMenuTrigger,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { Formatting } from "@/helpers/formatter";
import { InviteEmbed } from "./InviteEmbed";
import {
  fetchMetadata,
  Metadata,
  fetchSpotifyEmbed,
  SpotifyEmbed,
} from "@/utils";
import { MessageAttachment } from "./MessageAttachment";

export function MessageComponent({
  message,
  key,
  sameAuthor,
  showMoreOptions,
  ghost,
  //setReferenceMessage,
}: MessageProps) {
  const contentRef = useRef<HTMLSpanElement>(null);

  const replyRef = useRef<HTMLSpanElement>(null);
  const [editable, setEditable] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<Invite | null | undefined>(
    null
  );
  const [metadataDetails, setMetadataDetails] = useState<Metadata | null>(null);
  const [spotifyEmbed, setSpotifyEmbed] = useState<SpotifyEmbed | null>(null);
  const metadataFetched = useRef(false);
  const spotifyEmbedFetched = useRef(false);
  const { openModal } = useModal();
  const { client } = useClient();
  ghost ||= false;

  useEffect(() => {
    if (editable && contentRef.current) {
      contentRef.current.focus();
    }
  }, [editable]);

  useEffect(() => {
    if (contentRef.current) {
      const isOnlyEmojis = /^(:\w+:)+$/.test(message.content!);

      if (isOnlyEmojis) {
        twemoji.parse(contentRef.current, {
          folder: "svg",
          ext: ".svg",
          className: "w-10 h-10",
        });
      } else {
        twemoji.parse(contentRef.current, {
          folder: "svg",
          ext: ".svg",
          className: "w-5 h-5",
        });
      }
    }

    client?.on("messageUpdate", (msg) => {
      if (message.id == msg.id) {
        setTimeout(() => {
          metadataFetched.current = false;
          spotifyEmbedFetched.current = false;
          setSpotifyEmbed(null);
          setMetadataDetails(null);
          const isOnlyEmojis = /^(:\w+:)+$/.test(message.content!);

          if (contentRef.current)
            if (isOnlyEmojis) {
              twemoji.parse(contentRef.current, {
                folder: "svg",
                ext: ".svg",
                className: "w-10 h-10",
              });
            } else {
              twemoji.parse(contentRef.current, {
                folder: "svg",
                ext: ".svg",
                className: "w-5 h-5",
              });
            }
        }, 1);
      }
    });

    client?.on("messageDelete", (msg) => {
      setTimeout(() => {
        metadataFetched.current = false;
        spotifyEmbedFetched.current = false;
        setSpotifyEmbed(null);
        setMetadataDetails(null);
      }, 1);
    });
  }, []);

  function extractInviteCode(url: string) {
    const regex =
      /(?:https?:\/\/)?(?:alpha\.strafechat\.dev)?\/invites\/([a-zA-Z0-9]+)/;
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
      case date.hasSame(now, "day"):
        return `Today at ${date
          .setLocale(client?.user?.locale!)
          .toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.plus({ days: 1 }).hasSame(now, "day"):
        return `Yesterday at ${date
          .setLocale(client?.user?.locale!)
          .toLocaleString(DateTime.TIME_SIMPLE)}`;
      case date.hasSame(now, "week"):
        return (
          "Last " +
          date.setLocale(client?.user?.locale!).toFormat("EEEE") +
          ` at ${date
            .setLocale(client?.user?.locale!)
            .toLocaleString(DateTime.TIME_SIMPLE)}`
        );
      default:
        return date
          .setLocale(client?.user?.locale!)
          .toLocaleString(DateTime.DATETIME_SHORT);
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
      setTimeout(() => {
        twemoji.parse(contentRef.current!, {
          folder: "svg",
          ext: ".svg",
          className: "w-7 h-7",
        });
      }, 1);
      setEditable(false);
    } else if (event.key == "Enter" && !event.shiftKey) {
      event.preventDefault();
      contentRef.current?.blur();
      setEditable(false);
      setTimeout(() => {
        twemoji.parse(contentRef.current!, {
          folder: "svg",
          ext: ".svg",
          className: "w-7 h-7",
        });
      }, 1);
      await message.edit({ content: contentRef.current?.innerText! });
    }
  };

  const transformMessage = (content: string) => {
    let text = content;
    const inviteCode = extractInviteCode(text);
    const urlRegex =
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const spotifyUrlRegex =
      /(?:https?:\/\/)?(?:open\.spotify\.com\/|spotify:(track|episode|album|playlist|artist):)(track|episode|album|playlist|artist)[\/:]([a-zA-Z0-9]{22})(?:\S+)?/;

    if (text && inviteCode) {
      client?.invites
        .fetch(inviteCode)
        .then((invite) => {
          setInviteDetails(invite);
        })
        .catch((error) => {
          console.error("Error fetching invite details:", error);
        });
    } else {
      if (text && urlRegex.test(text)) {
        if (!spotifyUrlRegex.test(text)) {
          if (!metadataFetched.current) {
            const matches = text.match(urlRegex);
            fetchMetadata(matches![0], (metadata) => {
              if (metadata) {
                setMetadataDetails(metadata);
                metadataFetched.current = true;
              }
            });
          }
        }
      }
    }

    if (text && spotifyUrlRegex.test(text)) {
      if (!spotifyEmbedFetched.current) {
        const matches = text.match(spotifyUrlRegex);
        fetchSpotifyEmbed(matches![0], (spotifyEmbed) => {
          if (spotifyEmbed) {
            setSpotifyEmbed(spotifyEmbed);
            spotifyEmbedFetched.current = true;
          }
        });
      }
    }

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

  const handleClearContent = () => {
    if (contentRef.current) {
      contentRef.current.innerText = "";
    }
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
                                  openModal("delete-message", { message });
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
                <ProfilePopup user={message.member.user} client>
                  <img
                    src={`${
                      message.sudo
                        ? message.sudo.avatar_url
                        : `${Formatting.formatAvatar(
                            message?.author.id,
                            message?.author.avatar
                          )}`
                    }`}
                    className="avatar"
                    draggable={false}
                    alt="Avatar"
                  />
                </ProfilePopup>
              </div>
              <div className="flex flex-col w-full">
                <span className="username bg-[room-list]">
                  <ProfilePopup user={message.member.user} client>
                    <p>
                      {message.sudo
                        ? message.sudo.name!
                        : message.author.display_name!}
                      {message.sudo && <span className="bot-tag">SUDO</span>}
                      {message.author.bot && !message.sudo && (
                        <span className="bot-tag">BOT</span>
                      )}
                    </p>
                  </ProfilePopup>
                  <span className="timestamp">
                    {formatTimestamp(message.createdAt)}{" "}
                    {message.editedAt && !editable && (
                      <span className="edited pt-[3px]">(edited)</span>
                    )}
                  </span>
                </span>
                <span
                  className={`content inline-flex ${
                    editable && "message-edtitable full"
                  } ${inviteDetails || message.embeds ? "flex-col" : ""}`}
                  ref={contentRef}
                  contentEditable={editable}
                  style={{ minHeight: editable ? "4vh" : "fit-content" }}
                  onKeyDown={(event) => handleInput(event)}
                  onInput={(event) => {
                    if (
                      (event.target as HTMLDivElement).innerText.trim() === ""
                    ) {
                      handleClearContent();
                    }
                  }}
                >
                  {message.content && (
                    <>
                      {editable && (message.content as string)}
                      {!editable && (
                        <ReactMarkdown
                          components={{ a: CustomLink }}
                          remarkPlugins={[
                            gfm,
                            remarkMath,
                            remarkFrontmatter,
                            remarkParse,
                          ]}
                        >
                          {transformMessage(message.content as string)!}
                        </ReactMarkdown>
                      )}
                    </>
                  )}
                </span>
                <span className="ml-[15px] pr-[20px]">
                  {message.attachments &&
                    message.attachments.map((attachment, index) => (
                      <MessageAttachment key={index} attachment={attachment} />
                    ))}
                  {message.embeds &&
                    message.embeds.map((embed, index) => (
                      <MessageEmbed key={index} embed={embed} />
                    ))}
                  {metadataDetails && (
                    <MessageEmbed
                      embed={{
                        author: metadataDetails.author,
                        url: metadataDetails.url,
                        title: metadataDetails.title,
                        description: metadataDetails.description,
                        color: metadataDetails.themecolor,
                        image: metadataDetails.image.url
                          ? metadataDetails.image
                          : null,
                        video: metadataDetails.video.url
                          ? metadataDetails.video
                          : null,
                      }}
                    />
                  )}

                  {inviteDetails && (
                    <InviteEmbed
                      key={`invite-${inviteDetails.code}`}
                      invite={inviteDetails}
                      client={client!}
                    />
                  )}
                  {spotifyEmbed && (
                    <div>
                      <iframe
                        className="rounded-[12px] my-1"
                        width={spotifyEmbed.width!}
                        height={spotifyEmbed.height!}
                        title={`Spotify Embed: ${spotifyEmbed.title}`}
                        allowFullScreen
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        src={spotifyEmbed.iframe_url!}
                      ></iframe>
                    </div>
                  )}
                </span>
              </div>
            </li>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() =>
                navigator.clipboard.writeText(`${message.author.id}`)
              }
            >
              Copy User Id
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => navigator.clipboard.writeText(`${message.id}`)}
            >
              Copy Message Id
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        <li
          key={key}
          className="group message"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
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
            )}{" "}
            {client?.user!.id == message.author.id && ( // Manage Message Permissions
              <div className="icon">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="icon">
                        <FontAwesomeIcon
                          className="danger"
                          icon={faTrashCan}
                          onClick={async () => {
                            openModal("delete-message", { message });
                          }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
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
            <span className="timestamp absolute text-center text-[11px] pt-2.5 px-3">
              {isHovered && messageDate.toLocaleString(DateTime.TIME_SIMPLE)}
            </span>
            <span
              className={`content pl-[60px] select-text inline-flex ${
                editable && "message-edtitable notfull"
              } ${inviteDetails || message.embeds ? "flex-col" : ""}`}
              ref={contentRef}
              style={{ minHeight: editable ? "4vh" : "fit-content" }}
              contentEditable={editable}
              onKeyDown={(event) => handleInput(event)}
              onInput={(event) => {
                if ((event.target as HTMLDivElement).innerText.trim() === "") {
                  handleClearContent();
                }
              }}
            >
              {message.content && (
                <>
                  {!editable && (
                    <ReactMarkdown
                      components={{ a: CustomLink }}
                      remarkPlugins={[
                        gfm,
                        remarkMath,
                        remarkFrontmatter,
                        remarkParse,
                      ]}
                    >
                      {transformMessage(message.content as string)}
                    </ReactMarkdown>
                  )}
                </>
              )}
            </span>
            <span className="ml-[75px] pr-[20px]">
              {message.attachments &&
                message.attachments.map((attachment, index) => (
                  <MessageAttachment key={index} attachment={attachment} />
                ))}
              {message.embeds &&
                message.embeds.map((embed, index) => (
                  <MessageEmbed key={index} embed={embed} />
                ))}
              {metadataDetails && (
                <MessageEmbed
                  embed={{
                    author: metadataDetails.author,
                    url: metadataDetails.url,
                    title: metadataDetails.title,
                    description: metadataDetails.description,
                    color: metadataDetails.themecolor,
                    image: metadataDetails.image.url
                      ? metadataDetails.image
                      : null,
                    video: metadataDetails.video.url
                      ? metadataDetails.video
                      : null,
                  }}
                />
              )}

              {inviteDetails && (
                <InviteEmbed
                  key={`invite-${inviteDetails.code}`}
                  invite={inviteDetails}
                  client={client!}
                />
              )}

              {spotifyEmbed && (
                <div>
                  <iframe
                    className="rounded-[12px] my-1"
                    width={spotifyEmbed.width!}
                    height={spotifyEmbed.height!}
                    title={`Spotify Embed: ${spotifyEmbed.title}`}
                    allowFullScreen
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    src={spotifyEmbed.iframe_url!}
                  ></iframe>
                </div>
              )}
            </span>
          </div>
        </li>
      )}
    </>
  );
}