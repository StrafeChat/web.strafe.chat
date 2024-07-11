import { Room } from "@strafechat/strafe.js";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  ClipboardEventHandler,
} from "react";
import { useClient } from "@/hooks";
import {
  FaFaceSmile,
  FaPlus,
  FaTrashCan,
  FaFile,
  FaPaperPlane,
} from "react-icons/fa6";
import { emojis } from "@/assets/emojis";
import twemoji from "twemoji";
import React, { Dispatch, SetStateAction } from "react";
import { Formatting } from "@/helpers/formatter";

export function ChatInput({
  placeholder,
  room,
}: {
  placeholder: string;
  room: Room;
}) {
  const { client } = useClient();
  const inputRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [viewImages, setViewImage] = useState<any[]>([]);
  const emojiPopupRef = useRef<HTMLDivElement>(null);
  const maxCharacters = 2000;
  const [characterCount, setCharacterCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<
    {
      avatar: string | undefined;
      id: string;
      displayName: string;
    }[]
  >([]);
  const [currentlyTyping, setCurrentlyTyping] = useState<boolean>(false);
  const [emojiPopupVisible, setEmojiPopupVisible] = useState(false);
  const [filteredEmojis, setFilteredEmojis] = useState<{
    [key: string]: string;
  }>({});
  const [emojiSearch, setEmojiSearch] = useState("");
  const [messageSending, setMessageSending] = useState(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key;

      if (
        key.match(/[a-zA-Z0-9]/) &&
        !inputRef.current?.contains(document.activeElement)
      ) {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    document.addEventListener("keypress", handleKeyPress);

    return () => {
      document.removeEventListener("keypress", handleKeyPress);
    };
  }, []);

  useEffect(() => {
    let typingTimeout: NodeJS.Timeout;

    const handleTypingStart = (data: any) => {
      if (data.room_id !== room.id) return;
      const { id, global_name, username, avatar } = data.user;
      const displayName = global_name || username;
      if (id === client?.user?.id) return;
      setTypingUsers((prevUsers) => {
        if (!prevUsers.some((user) => user.id === id)) {
          return [...prevUsers, { id, displayName, avatar }];
        }
        return prevUsers;
      });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        setTypingUsers((prevUsers) =>
          prevUsers.filter((user) => user.id !== id)
        );
      }, 10000);
    };

    const handleMessageCreate = (message: any) => {
      setTypingUsers((prevUsers) =>
        prevUsers.filter((user) => user.id !== message.author.id)
      );
    };

    client?.on("typingStart", handleTypingStart);
    client?.on("messageCreate", handleMessageCreate);

    return () => {
      client?.off("typingStart", handleTypingStart);
      client?.off("messageCreate", handleMessageCreate);
      clearTimeout(typingTimeout);
    };
  }, [client, room.id]);

  const handleInput = useCallback(async () => {
    if (inputRef.current) {
      const text = inputRef.current.innerText;
      setContent(text);
      setCharacterCount(text.length);

      const match = text.match(/:([a-zA-Z0-9_+-]{2,})$/);
      if (match) {
        const search = match[1];
        setEmojiSearch(search);
        setFilteredEmojis(
          Object.fromEntries(
            Object.entries(emojis).filter(([name]) => name.startsWith(search))
          )
        );
        setEmojiPopupVisible(true);
      } else {
        setEmojiPopupVisible(false);
      }

      if (!currentlyTyping && text.length > 0) {
        setCurrentlyTyping(true);
        await room.sendTyping();
        setTimeout(() => {
          setCurrentlyTyping(false);
        }, 10000);
      }
    }
  }, [room, currentlyTyping]);

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

  useEffect(() => {
    if (emojiPopupVisible) {
      const popup = emojiPopupRef.current;
      if (popup) {
        twemoji.parse(popup, {
          folder: "svg",
          ext: ".svg",
          className: "w-7 h-7",
        });
      }
    }
  }, [emojiPopupVisible, filteredEmojis]);

  const handleEmojiSelect = (emoji: string) => {
    if (inputRef.current) {
      const text = inputRef.current.innerText;
      const newText = text.replace(/:([a-zA-Z0-9_+-]*)$/, emoji);
      inputRef.current.innerText = newText;
      setContent(newText);
      setCharacterCount(newText.length);
      setEmojiPopupVisible(false);

      const range = document.createRange();
      const selection = window.getSelection();
      if (selection && inputRef.current) {
        range.selectNodeContents(inputRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      inputRef.current.focus();
    }
  };

  const handleClearContent = () => {
    if (inputRef.current) {
      inputRef.current.innerText = "";
      setContent("");
      setCharacterCount(0);
      setEmojiPopupVisible(false);
      setEmojiSearch("");
      setFilteredEmojis({});
    }
  };

  const handleEmojiPopupKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.key === "Enter") {
      // Select emoji when Enter is pressed
      const emojiName = event.currentTarget.getAttribute("data-name");
      if (emojiName && filteredEmojis[emojiName]) {
        handleEmojiSelect(`:${emojiName}:`);
      }
    } else if (event.key === "Escape") {
      // Close emoji popup on Escape
      setEmojiPopupVisible(false);
      inputRef.current?.focus(); // Return focus to the input
    } else if (event.key === "Tab" && !event.shiftKey) {
      // Prevent tabbing out of emoji popup
      event.preventDefault();
      const nextEmojiItem = event.currentTarget
        .nextElementSibling as HTMLElement;
      if (nextEmojiItem) {
        nextEmojiItem.focus();
      }
    } else if (event.key === "Tab" && event.shiftKey) {
      // Prevent tabbing out of emoji popup (reverse direction)
      event.preventDefault();
      const prevEmojiItem = event.currentTarget
        .previousElementSibling as HTMLElement;
      if (prevEmojiItem) {
        prevEmojiItem.focus();
      }
    }
  };

  function isImage(value: any) {
    const types = ["image/png", "image/gif", "image/jpeg", "image/webp"];
    const video = ["video/mp4"];
    if (types.find((val) => val === value)) return "image";
    else if (video.find((val) => val === value)) return "video";
    else return "other";
  }

  const onSelectFile = useCallback(
    (e: any | null) => {
      if (!e || e?.files?.length === 0 || e?.target?.files?.length === 0)
        return;

      const selectedFiles = Array.from(e?.target?.files! || e?.files);

      const validFiles = selectedFiles.filter((file: any) => {
        if (file.size <= 25 * 1024 * 1024) {
          return true;
        } else {
          alert(
            `${file.name} exceeds the 25MB size limit and will not be uploaded.`
          );
          return false;
        }
      });

      if (validFiles.length === 0) return;

      Promise.all(
        validFiles.map((file: any) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
              let id = Math.round(
                +(Date.now() * file.name.length * Math.random()).toString()
              );
              resolve({
                id,
                file: reader.result,
                name: file.name,
                type: file.type,
              });
            };
          });
        })
      ).then((results: any) => {
        setViewImage([...viewImages, ...results]);
      });
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    [viewImages]
  );

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      event.preventDefault();
      let text = event.clipboardData!.getData("text/plain");
      if (event.clipboardData!.files.length > 0)
        onSelectFile(event.clipboardData!);
      if (text) document.execCommand("insertText", false, text);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onSelectFile]);

  return (
    <div className="chat-input-container">
      {emojiPopupVisible && (
        <div
          className="emoji-popup"
          ref={emojiPopupRef}
          onKeyDown={handleEmojiPopupKeyDown}
          tabIndex={0} // Ensure the popup can receive focus
        >
          {Object.entries(filteredEmojis).map(([name, emoji]) => (
            <div
              key={name}
              className="emoji-item"
              data-name={name}
              tabIndex={0} // Make each emoji item focusable
              onClick={() => handleEmojiSelect(`:${name}:`)}
            >
              {emoji} :{name}:
            </div>
          ))}
        </div>
      )}

      {messageSending && (
        <div className="relative w-full h-[2rem] bg-chatinput rounded-[10px] flex items-center mb-2">
          <div className="flex flex-row px-4 items-center w-full">
            <FaPaperPlane className="inline-block mr-2" />
            <span>
              Sending Message<span className="typing-indicator"></span>
            </span>
          </div>
        </div>
      )}

      {viewImages.length > 0 && (
        <div className="relative w-full h-[10rem] bg-chatinput rounded-[15px] flex overflow-x-auto overflow-y-hidden items-center mb-2">
          <div className="absolute justify-between flex flex-row px-4 gap-4 items-center">
            {viewImages.map((fi) => (
              <div
                className="relative text-white bg-[#2B2D31] h-[8rem] w-[8rem] p-2 pb-2 items-center justify-center rounded-sm flex"
                key={fi.id}
              >
                <FaTrashCan
                  onClick={() =>
                    setViewImage((files) =>
                      files.filter((file) => file.id !== fi.id)
                    )
                  }
                  height="20"
                  className="cursor-pointer hover:text-red-500 rounded-sm absolute"
                  style={{ right: -10, bottom: -9 }}
                />
                <div
                  className="absolute select-none"
                  style={{ fontSize: "9px", left: 3, bottom: 0 }}
                >
                  {fi.name.length > 16 ? `${fi.name.slice(0, 18)}...` : fi.name}
                </div>
                {isImage(fi.type) === "image" && (
                  <img
                    src={fi.file}
                    alt={fi.id}
                    className="max-h-24 max-w-max"
                    draggable={false}
                  />
                )}

                {isImage(fi.type) === "video" && (
                  <video
                    disablePictureInPicture
                    disableRemotePlayback
                    className="max-h-24"
                  >
                    <source src={fi.file} type="video/mp4" />
                  </video>
                )}

                {isImage(fi.type) === "other" && (
                  <FaFile className="w-[75%] h-[75%]" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={`chat-input !${emojiPopupVisible && "rounded-[0px]"}`}>
        <div className="chat-input-left">
          <FaPlus
            className="w-6 h-6 cursor-pointer"
            onClick={() => document.getElementById("fileInput")?.click()}
          />
          <input
            type="file"
            id="fileInput"
            className="hidden"
            multiple
            onChange={onSelectFile}
          />
        </div>
        <div
          ref={inputRef}
          className="chat-input-middle"
          contentEditable={true}
          suppressContentEditableWarning
          {...{ placeholder }}
          id="textbox"
          role="textbox"
          onKeyDown={async (event) => {
            if (event.key === "Enter" && !event.shiftKey && !messageSending) {
              event.preventDefault();
              if (content.length < 1 && viewImages.length < 1) return;
              setMessageSending(true);
              const message = await room.send({
                content,
                attachments: viewImages,
              });
              console.log(message)
              if (message) setMessageSending(false);
              setContent("");
              setCharacterCount(0);
              setCurrentlyTyping(false);
              setEmojiPopupVisible(false);
              // setReferenceMessage(null);
              setViewImage([]);
              (event.target as HTMLElement).innerText = "";
            }
          }}
          onInput={(event) => {
            if ((event.target as HTMLDivElement).innerText.trim() === "") {
              handleClearContent();
            }
          }}
        />
        <div className="chat-input-right">
          <FaFaceSmile className="w-6 h-6" />
        </div>
      </div>
      <span className="typing">
        {typingUsers.length > 0 && (
          <>
            <div className="avatars">
              {typingUsers.slice(0, 4).map((user, index) => (
                <img
                  key={user.id}
                  src={Formatting.formatAvatar(user?.id, user?.avatar)}
                  alt={user.displayName}
                  className={`avatar avatar-${index}`}
                />
              ))}
              {typingUsers.length > 4 && (
                <span className="more-avatars">...</span>
              )}
            </div>
            <span className="user-names">
              {typingUsers.length > 4
                ? " Several people are typing"
                : typingUsers.map((user, index) => (
                    <React.Fragment key={user.id}>
                      {index > 0 && ", "}
                      {(typingUsers.length === 2 || typingUsers.length === 3) &&
                        index === typingUsers.length - 1 &&
                        " and "}
                      <b>{user.displayName}</b>
                    </React.Fragment>
                  ))}
            </span>
            {typingUsers.length <= 4 && typingUsers.length > 1
              ? " are typing"
              : typingUsers.length === 1
              ? " is typing"
              : ""}
            <span className="typing-indicator"></span>
          </>
        )}
      </span>
    </div>
  );
}