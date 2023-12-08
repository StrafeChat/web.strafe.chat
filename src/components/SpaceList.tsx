import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faCompass,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";

import { User } from "@/context/AuthContext";
import { useState } from "react";
import UserSettingsModal from "./modals/UserSettingsModal";
import Link from "next/link";

export default function SpaceList({ user }: { user: User }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="spaces">
      <div className="avatar">
        <ContextMenu>
          <ContextMenuTrigger>
            <Link href={'/'}>
              <Image
                priority
                draggable={false}
                src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${user.avatar}.png`}
                width={50}
                height={50}
                alt="avatar"
              />
            </Link>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => setShowSettings(true)}>
              Settings
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
      <UserSettingsModal show={showSettings} set={setShowSettings} />
    </div>
  );
}
