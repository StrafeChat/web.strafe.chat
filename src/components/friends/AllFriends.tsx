import { Relationship, User, useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { ContextMenu } from "../ui/context-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export default function AllFriends({
  relationships,
}: {
  relationships: Relationship[];
}) {
  const { user } = useAuth();

  return (
    <div className="p-[2rem] flex flex-col">
      <span className="uppercase font-bold text-gray-500 pb-[7px]">
        All Friends - {relationships.length}
      </span>
      {relationships.map((relationship, key) => {
        const currentUser: User =
          relationship.receiver_id != user.id
            ? relationship.receiver
            : relationship.sender;
            
        return (
          <ContextMenu key={key}>
            <ContextMenuTrigger>
              <div className="w-full p-2 hover:rounded-[0.25rem] hover:bg-gray-500 flex justify-between cursor-pointer">
                <div className="flex gap-2 w-fit items-center">
                  <Image
                    className="avatar"
                    src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${currentUser.avatar}.png`}
                    width={40}
                    height={40}
                    alt="profile"
                  />
                  <span className="text-white">
                    <span className="text-sm font-bold">
                      {currentUser.username}
                    </span>
                    <span className="block text-sm">
                      {currentUser.presence.status}
                    </span>
                  </span>
                </div>{" "}
                <div className="flex w-fit items-center"></div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Profile</ContextMenuItem>
              <ContextMenuItem>Message</ContextMenuItem>
              <ContextMenuItem>Call</ContextMenuItem>
              <ContextMenuItem>Remove Friend</ContextMenuItem>
              <ContextMenuItem>Block</ContextMenuItem>
              <ContextMenuItem
                onClick={() => navigator.clipboard.writeText(currentUser.id)}
              >
                Copy User ID
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
