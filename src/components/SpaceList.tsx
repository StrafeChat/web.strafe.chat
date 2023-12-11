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

export default function SpaceList({ user }: { user: User }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showSetStatus, setShowSetStatus] = useState(false);
  const { ws, setUser } = useAuth();

  return (
    <div className="spaces">
      <div className="avatar">
        <ContextMenu>
          <ContextMenuTrigger>
            <Link href={'/'}>
              <div className="relative">
                <Image
                  priority
                  draggable={false}
                  src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${user.avatar}.png`}
                  width={50}
                  height={50}
                  alt="avatar"
                />
                <div
                  className={`w-5 h-5 status-${user.presence.status} absolute bottom-0 right-0 border-[3px] border-[#141414] rounded-full`}
                ></div>
              </div>
            </Link>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => setShowSettings(true)}>
              <FontAwesomeIcon icon={faGear} />&nbsp;&nbsp;Settings
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copy(user.id)}><FontAwesomeIcon icon={faCopy} />&nbsp;&nbsp;Copy User ID</ContextMenuItem>
            <hr className="opacity-5 mx-[5px]"></hr>
            <ContextMenuItem onClick={() => updatePresence(ws?.current, setUser, { status: "online" })}>
              <FontAwesomeIcon icon={faCircle} className="text-[#22c55e]" />&nbsp; Online
            </ContextMenuItem>
            <ContextMenuItem onClick={() => updatePresence(ws?.current, setUser, { status: "idle" })}>
              <FontAwesomeIcon icon={faCircle} className="text-[#eab308]" />&nbsp; Idle
            </ContextMenuItem>
            <ContextMenuItem onClick={() => updatePresence(ws?.current, setUser, { status: "sleeping" })}>
              <FontAwesomeIcon icon={faCircle} className="text-[#f97316]" />&nbsp; Sleeping
            </ContextMenuItem>
            <ContextMenuItem onClick={() => updatePresence(ws?.current, setUser, { status: "coding" })}>
              <FontAwesomeIcon icon={faCircle} className="text-[#3b82f6]" />&nbsp; Coding
            </ContextMenuItem>
            <ContextMenuItem onClick={() => updatePresence(ws?.current, setUser, { status: "dnd" })}>
              <FontAwesomeIcon icon={faCircle} className="text-[#ef4444]" />&nbsp; Do Not Disturb
            </ContextMenuItem>
            <ContextMenuItem onClick={() => updatePresence(ws?.current, setUser, { status: "offline" })}>
              <FontAwesomeIcon icon={faCircle} className="text-[#6b7280]" />&nbsp; Offline
            </ContextMenuItem>
            <hr className="opacity-5 mx-[5px]"></hr>
            <ContextMenuItem onClick={() => setShowSetStatus(true)}>
              <FontAwesomeIcon icon={faPenToSquare} />&nbsp; Custom
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <div className="spacebar"></div>
        <ul className="spaces">
          <Link href="/">
            {/* Make this trigger a modal to create a space*/}
            <div
              className="bg-[#1c1c1c] w-10 h-10 rounded-full flex items-center justify-center m-[3px]"
              title="Add Space"
            >
              <FontAwesomeIcon icon={faPlus} className="w-7 h-7 text-[#737d3c]" />
            </div>
          </Link>
          <Link href="/discover">
            {/* Make this trigger a modal to create a space*/}
            <div
              className="bg-[#1c1c1c] w-10 h-10 rounded-full flex items-center justify-center my-[3px]"
              title="View Discover"
            >
              <FontAwesomeIcon
                icon={faCompass}
                className="w-7 h-7 text-[#737d3c]"
              />
            </div>
          </Link>
        </ul>
      </div>
      <ChangeStatusModal show={showSetStatus} set={setShowSetStatus} />
      <UserSettingsModal show={showSettings} set={setShowSettings} />
    </div>
  );
}
