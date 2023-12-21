import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserGroup,
  faNoteSticky,
  faHouseChimney,
} from "@fortawesome/free-solid-svg-icons";
import { Room, useRoom } from "@/context/RoomContext";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useState } from "react";
import Skeleton from "./Skeleton";
import { Formatting } from "@/scripts/Formatting";
import { ContextMenu } from "./ui/context-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@radix-ui/react-context-menu";

export default function RoomList() {
  const { user, ws } = useAuth();
  const { pms } = useRoom();
  const router = useRouter();
  const pathname = usePathname();

 /* useEffect(() => {
    const handleWsMessage = (evt: MessageEvent<any>) => {
      const { op, data, event } = JSON.parse(evt.data);
      switch (op) {
        case 3:
          switch (event) {
            case "MESSAGE_CREATE":
              if (pms) {
                setPmsList((pms) => {
                const updatedPms = pms!.map((pm) => {
                  if (pm.id === data.room_id) {
                    return {
                      ...pm,
                      last_message_id: data.id,
                    };
                  }
                  return pm;
                });
                return updatedPms;
              });
            }
           break;
      }
    };
  };
  ws?.current?.addEventListener("message", handleWsMessage);

  return () => {
    ws?.current?.removeEventListener("message", handleWsMessage);
  };
}, [setPmsList, ws, pms]);*/

  return (
    <ul className="rooms-wrapper">
      <div className="header">
        <span>
          <b>Private Messages</b>
        </span>
      </div>
      <div className="rooms-container">
        <li
          className={pathname == "/" ? "active" : ""}
          onClick={() => {
            router.push("/");
          }}
        >
          <span className="icon">
            <FontAwesomeIcon icon={faHouseChimney} />
          </span>
          <span className="content">Home</span>
        </li>
        <li
          className={pathname == "/friends" ? "active" : ""}
          onClick={() => {
            router.push("/friends");
          }}
        >
          <span className="icon">
            <FontAwesomeIcon icon={faUserGroup} />
          </span>
          <span className="content">Friends</span>
        </li>
        <li
          className={pathname == "/notes" ? "active" : ""}
          onClick={() => {
            router.push("/notes");
          }}
        >
          <span className="icon">
            <FontAwesomeIcon icon={faNoteSticky} />
          </span>
          <span className="content">Notes</span>
        </li>
        <span className="convo-title">Conversations</span>
        <ul className="rooms">
          {pms.length == 0 && (
            <div className="flex flex-col gap-2 w-full items-center pt-[10px]">
              <Skeleton className="w-[calc(100%-12px)] h-[51px] rounded-[4px]">
                <div className="flex items-center w-full h-full px-4 gap-4">
                  <Skeleton className="w-[35px] h-[35px] bg-[var(--skeleton-background-secondary)] rounded-full" />
                  <Skeleton className="w-[calc(100%-51px)] h-[35px] bg-[var(--skeleton-background-secondary)] rounded-[4px]" />
                </div>
              </Skeleton>
              <Skeleton className="w-[calc(100%-12px)] h-[51px] rounded-[4px]">
                <div className="flex items-center w-full h-full px-4 gap-4 opacity-30">
                  <Skeleton className="w-[35px] h-[35px] bg-[var(--skeleton-background-secondary)] rounded-full" />
                  <Skeleton className="w-[calc(100%-51px)] h-[35px] bg-[var(--skeleton-background-secondary)] rounded-[4px]" />
                </div>
              </Skeleton>
              <Skeleton className="w-[calc(100%-12px)] h-[51px] rounded-[4px]">
                <div className="flex items-center w-full h-full px-4 gap-4 opacity-20">
                  <Skeleton className="w-[35px] h-[35px] bg-[var(--skeleton-background-secondary)] rounded-full" />
                  <Skeleton className="w-[calc(100%-51px)] h-[35px] bg-[var(--skeleton-background-secondary)] rounded-[4px]" />
                </div>
              </Skeleton>
            </div>
          )}
          {pms!.sort((a, b) => {
           const idA = parseInt(a.last_message_id! ?? 0);
           const idB = parseInt(b.last_message_id! ?? 0);
             return idB - idA;
           })
           .map((pm, key) => {
              switch (pm.type) {
                 case 0:
                   const currentUser = pm.recipients?.find(
                   (recipient) => recipient.id != user.id
                 );
                return (
                  <ContextMenu key={key}>
                    <ContextMenuTrigger>
                      <li
                        className="pm"
                        onClick={() => router.push(`/rooms/${pm.id}`)}
                      >
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className="avatar"
                            src={Formatting.avatar(
                              currentUser!.id,
                              currentUser!.avatar
                            )}
                            width={35}
                            height={35}
                            alt="profile"
                          />
                          {currentUser?.presence.online === true ? (
                            <div
                              className={`absolute bottom-0 right-0 mr-[-2.25px] mb-[-2.25px] border-[2.75px] border-[#1f1f1f] rounded-full w-[16px] h-[16px] status-${currentUser?.presence.status}`}
                            />
                          ) : (
                            <div
                              className={`absolute bottom-0 mr-[-2.25px] mb-[-2.25px] right-0 border-[2.75px] border-[#1f1f1f] w-[16px] h-[16px] status-offline rounded-full`}
                            ></div>
                          )}
                        </div>
                        <span className="content">
                          <span className="username">
                            {currentUser?.username}
                          </span>
                          <span className="status-text text-gray-400">
                            {currentUser?.presence.online
                              ? currentUser?.presence.status_text &&
                                currentUser?.presence.status_text.trim() !== ""
                                ? currentUser?.presence.status_text
                                : currentUser?.presence.status
                                    .charAt(0)
                                    .toUpperCase() +
                                  currentUser?.presence.status.slice(1)
                              : "Offline"}
                          </span>
                        </span>
                      </li>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="p-2 z-[9999]">
                      <ContextMenuItem className="p-1">Close PM</ContextMenuItem>
                      <ContextMenuItem className="p-1">Block</ContextMenuItem>
                      <ContextMenuItem className="p-1">Copy User ID</ContextMenuItem>
                      <ContextMenuItem className="p-1">Copy Room ID</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
            }
          })}
        </ul>
      </div>
    </ul>
  );
}
