import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faCompass,
  faGear,
  faCopy,
  faCircle,
  faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";

import { User, useAuth } from "@/context/AuthContext";
import { useState } from "react";
import UserSettingsModal from "./modals/UserSettingsModal";
import Link from "next/link";
import { copy, updatePresence } from "@/scripts/ContextMenu";
import ChangeStatusModal from "./modals/ChangeStatusModal";
import CreateSpaceModal from "./modals/CreateSpaceModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import { Formatting } from "@/scripts/Formatting";

export default function SpaceList({ user }: { user: User }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showSetStatus, setShowSetStatus] = useState(false);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const { ws, setUser } = useAuth();

  return (
    <div className="spaces">
      <div className="avatar">
        <ContextMenu>
          <ContextMenuTrigger>
            <TooltipProvider disableHoverableContent={true}>
              <Tooltip>
                <TooltipTrigger>
                  <Link href={"/"}>
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        draggable={false}
                        src={Formatting.avatar(user.id, user.avatar)}
                        width={50}
                        height={50}
                        className="avatar"
                        alt="avatar"
                      />
                      <div
                        className={`w-5 h-5 status-${user.presence.status} absolute bottom-0 right-0 border-[3px] border-[#141414] rounded-full`}
                      ></div>
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {user.global_name && <span>{user.global_name}</span>}
                  <span>
                    {user.username}#
                    {user.discriminator.toString().padStart(4, "0")}
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => setShowSettings(true)}>
              <FontAwesomeIcon icon={faGear} />
              &nbsp;&nbsp;Settings
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copy(user.id)}>
              <FontAwesomeIcon icon={faCopy} />
              &nbsp;&nbsp;Copy User ID
            </ContextMenuItem>
            <hr className="opacity-5 mx-[5px]"></hr>
            <ContextMenuItem
              onClick={() =>
                updatePresence(ws?.current, setUser, { status: "online" })
              }
            >
              <FontAwesomeIcon icon={faCircle} className="text-[#22c55e]" />
              &nbsp; Online
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                updatePresence(ws?.current, setUser, { status: "idle" })
              }
            >
              <FontAwesomeIcon icon={faCircle} className="text-[#eab308]" />
              &nbsp; Idle
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                updatePresence(ws?.current, setUser, { status: "sleeping" })
              }
            >
              <FontAwesomeIcon icon={faCircle} className="text-[#f97316]" />
              &nbsp; Sleeping
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                updatePresence(ws?.current, setUser, { status: "coding" })
              }
            >
              <FontAwesomeIcon icon={faCircle} className="text-[#3b82f6]" />
              &nbsp; Coding
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                updatePresence(ws?.current, setUser, { status: "dnd" })
              }
            >
              <FontAwesomeIcon icon={faCircle} className="text-[#ef4444]" />
              &nbsp; Do Not Disturb
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                updatePresence(ws?.current, setUser, { status: "offline" })
              }
            >
              <FontAwesomeIcon icon={faCircle} className="text-[#6b7280]" />
              &nbsp; Offline
            </ContextMenuItem>
            <hr className="opacity-5 mx-[5px]"></hr>
            <ContextMenuItem onClick={() => setShowSetStatus(true)}>
              <FontAwesomeIcon icon={faPenToSquare} />
              &nbsp; Custom
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <div className="spacebar"></div>
        <ul className="spaces">
          {/* Make this trigger a modal to create a space*/}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className="bg-[#1c1c1c] w-10 h-10 rounded-full flex items-center justify-center m-[3px] cursor-pointer"
                  onClick={() => setShowCreateSpace(true)}
                >
                  <FontAwesomeIcon
                    icon={faPlus}
                    className="w-7 h-7 text-[#737d3c]"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Create a Space</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Link href="/discover">
                  <div className="bg-[#1c1c1c] w-10 h-10 rounded-full flex items-center justify-center my-[3px]">
                    <FontAwesomeIcon
                      icon={faCompass}
                      className="w-7 h-7 text-[#737d3c]"
                    />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">View Discover</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ul>
      </div>
      {showSetStatus && (
        <ChangeStatusModal show={showSetStatus} set={setShowSetStatus} />
      )}
      {showCreateSpace && (
        <CreateSpaceModal show={showCreateSpace} set={setShowCreateSpace} />
      )}
      {showSettings && (
        <UserSettingsModal show={showSettings} set={setShowSettings} />
      )}
    </div>
  );
}
