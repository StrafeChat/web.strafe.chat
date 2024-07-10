import { useUI } from "@/providers/UIProvider";
import { motion, useAnimation } from "framer-motion";
import localForage from "localforage";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import PrivateMessages from "./PrivateMessageRoomList";
import RoomsNav from "./SpaceRoomList";
import { FaGear, FaMicrophone, FaMicrophoneLinesSlash, FaMicrophoneSlash, FaPhoneSlash } from "react-icons/fa6";
import { useClient, useModal } from "@/hooks";
import { Formatting } from "@/helpers/formatter";
import { useVoice } from "@/hooks";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function RoomList() {
  const { isVoiceMuted, toggleVoiceMute, connection, disconnect, roomInfo } = useVoice();

  const controls = useAnimation();
  const { hideRoomList, setHideRoomList } = useUI();
  const { client } = useClient();
  const { openModal } = useModal();
  const path = usePathname();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    localForage.getItem<boolean>("hide_room_list").then((hidden) => {
      setHideRoomList(!!hidden);
    });
  }, [setHideRoomList]);

  useEffect(() => {
    controls.start({
      width: hideRoomList ? 0 : "260px",
      minWidth: hideRoomList ? 0 : "260px",
    });
    localForage.setItem("hide_room_list", hideRoomList);
    typeof window !== "undefined" &&
      window.dispatchEvent(new Event("hide-sidebar"));
  }, [hideRoomList, controls]);

  const paths = path!
    .trim()
    .split("/")
    .filter((x) => x !== "" && x !== "spaces" && x !== "rooms");

  return (
    <>
      <motion.div
        style={{ width: "260px", overflow: "hidden"}}
        initial={false}
        animate={{
          width: hideRoomList ? 0 : "260px",
          minWidth: hideRoomList ? 0 : "260px",
        }}
        transition={{ duration: 0.5, ease: "easeIn" }}
      >
        <div className="room-list">
          {(() => {
            switch (path) {
              case "/":
              case "/friends":
              case "/notes":
                return <PrivateMessages />;
              default:
                if (path!.startsWith("/rooms")) return <PrivateMessages />;
                if (path!.startsWith("/spaces"))
                  return (
                    <RoomsNav
                      params={{
                        spaceId: paths[0],
                      }}
                    />
                  );
                break;
            }
          })()}
          {
          (connection && roomInfo.room) ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              padding: "0.75rem",
              backgroundColor: "hsl(var(--client-user))",
              borderBottom: "1px solid hsl(var(--seperator))"
            }}>
              <div style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
              }}>
                <Link href={`/spaces/${roomInfo.room.spaceId}/rooms/${roomInfo.room.id}`}>
                  Connected to {roomInfo.room.name}
                </Link>
                <Button variant={
                  "secondary"
                } style={{
                  marginLeft: "auto",
                  verticalAlign: "middle",
                }} onClick={() => {
                  disconnect();
                }}>
                  <FaPhoneSlash style={{
                    //marginLeft: "auto",
                    //verticalAlign: "middle",
                    fontSize: "130%"
                  }} ></FaPhoneSlash>
                </Button>
              </div>
            </div>
          ) : (<></>)
          }
          <div
            className="h-[55px] bottom-0 bg-clientuser p-3 flex items-center"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="flex items-center relative">
              <img
                src={`${Formatting.formatAvatar(
                  client?.user?.id,
                  client?.user?.avatar
                )}`}
                className="w-8 h-8 rounded-full"
              />
              <div
                className={`avatar-status-client-user ${client?.user?.presence.status}`}
              ></div>
            </div>
            <div className="flex flex-col ml-2 mt-[-18px]">
              <span className="mr-4 font-bold">
                {client?.user?.displayName}
              </span>
              <span className="text-xs relative w-[100px] inline-block">
                <span
                  className={`w-full overflow-ellipsisa absolute overflow-hidden whitespace-nowrap block transition-opacity duration-300 ease-in-out ${
                    !hovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {Formatting.formatStatusText(client?.user?.presence!)}
                </span>
                <span
                  className={`w-full overflow-ellipsis absolute overflow-hidden whitespace-nowrap block transition-opacity duration-300 ease-in-out ${
                    hovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {`${client?.user?.username}#${client?.user?.discriminator}`}
                </span>
              </span>
            </div>
            <div className="flex-grow"></div>
            <div className="flex items-center">
             {isVoiceMuted ? <FaMicrophoneSlash style={{color: "#f23f42"}} onClick={() => toggleVoiceMute()} size={20}
                className="cursor-pointer mr-2" /> : <FaMicrophone onClick={() => toggleVoiceMute()} size={20}
                className="cursor-pointer mr-2" />}
              <FaGear
                onClick={() => openModal("settings")}
                size={20}
                className="cursor-pointer"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
