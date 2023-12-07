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
        <hr className="hr"></hr>
      </div>
      <UserSettingsModal show={showSettings} set={setShowSettings} />
    </div>
  );
}
