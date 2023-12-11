import { Relationship, User, useAuth } from "@/context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faBan,
  faUserMinus,
  faPhone,
  faMessage,
  faIdCard
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import { ContextMenu } from "../ui/context-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copy, createPM, removeFriend } from "@/scripts/ContextMenu";

export default function AllFriends({
  relationships,
}: {
  relationships: Relationship[];
}) {
  const { user,setRelationships } = useAuth();

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
              <div className="w-full p-2 hover:rounded-[0.25rem] hover:bg-[#2b2b2b] flex justify-between cursor-pointer">
                <div className="flex gap-2 w-fit items-center">
                  <div className="relative">
                  <Image
                    className="avatar"
                    src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${currentUser.avatar}.png`}
                    width={40}
                    height={40}
                    alt="profile"
                  />
                  { currentUser.presence.online === true ? <div
                   className={`absolute right-0 mr-[-1.5px] mb-[-1.5px] border-[2.75px] border-[#262626] bottom-0 w-[17px] h-[17px] status-${currentUser.presence.status} rounded-full`}
                  /> : <div className={`absolute mr-[-1.5px] mb-[-1.5px] right-0 border-[2.75px] border-[#262626] bottom-0 w-[17px] h-[17px] status-offline rounded-full`}></div>
                    }
                  </div>
                  <span className="text-white">
                    <span className="text-sm font-bold">
                      {currentUser.username}
                    </span>
                    <span className="block text-sm text-gray-400">
                    {
                         currentUser.presence.online
                       ? currentUser.presence.status_text && currentUser.presence.status_text.trim() !== ''
                       ? currentUser.presence.status_text
                       : currentUser.presence.status.charAt(0).toUpperCase() +
                         currentUser.presence.status.slice(1)
                        : "Offline"
                      }
                    </span>
                  </span>
                </div>{" "}
                <div className="flex w-fit items-center"></div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
            <ContextMenuItem><FontAwesomeIcon icon={faIdCard} className="pr-[6px]" />Profile</ContextMenuItem>
              <ContextMenuItem onClick={() => createPM(currentUser.id)}>
              <FontAwesomeIcon icon={faMessage} className="pr-[7px]" />Message
              </ContextMenuItem>
              <ContextMenuItem><FontAwesomeIcon icon={faPhone} className="pr-[7px]" />Call</ContextMenuItem>
              <hr className="opacity-5 mx-[5px]"></hr>
              <ContextMenuItem className="text-red-600"
                onClick={() =>
                  removeFriend(
                    currentUser.username,
                    currentUser.discriminator,
                    setRelationships
                  )
                }
              >
                <FontAwesomeIcon icon={faUserMinus} className="pr-[4px]" />Remove Friend
              </ContextMenuItem>
              <ContextMenuItem className="text-red-600"><FontAwesomeIcon icon={faBan} className="pr-[7px]" />Block</ContextMenuItem>
              <hr className="opacity-5 mx-[5px]"></hr>
              <ContextMenuItem onClick={() => copy(currentUser.id)}>
              <FontAwesomeIcon icon={faCopy} className="pr-[8px]" />Copy User ID
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
