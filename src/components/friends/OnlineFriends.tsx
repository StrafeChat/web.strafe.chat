import { Relationship, User, useAuth } from "@/context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faBan,
  faUserMinus,
  faPhone,
  faMessage,
  faIdCard,
  faEllipsisVertical,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import { ContextMenu } from "../ui/context-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copy, createPM, removeFriend } from "@/scripts/ContextMenu";
import { Formatting } from "@/scripts/Formatting";

export default function OnlineFriends({
  relationships,
}: {
  relationships: Relationship[];
}) {
  const { user, setRelationships } = useAuth();

  return (
    <div className="friends">
      <span className="count">Online - {relationships.length}</span>
      {relationships.map((relationship, key) => {
        const currentUser: User =
          relationship.receiver_id != user.id
            ? relationship.receiver
            : relationship.sender;

        return (
          <ContextMenu key={key}>
            <ContextMenuTrigger>
              <div className="friend">
                <div className="info">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="avatar"
                      src={Formatting.avatar(currentUser.id, currentUser.avatar)}
                      width={40}
                      height={40}
                      alt="profile"
                    />
                    {currentUser.presence.online === true ? (
                      <div
                        className={`absolute right-0 mr-[-1.5px] mb-[-1.5px] border-[2.75px] border-[#262626] bottom-0 w-[17px] h-[17px] status-${currentUser.presence.status} rounded-full`}
                      />
                    ) : (
                      <div
                        className={`absolute right-0 mr-[-1.5px] mb-[--1.5px] border-[2.75px] border-[#262626] bottom-0 w-[17px] h-[17px] status-offline rounded-full`}
                      ></div>
                    )}
                  </div>
                  <span>
                    <span className="username">{currentUser.username}</span>
                    <span className="status">
                      {currentUser.presence.online
                        ? currentUser.presence.status_text &&
                          currentUser.presence.status_text.trim() !== ""
                          ? currentUser.presence.status_text
                          : currentUser.presence.status
                              .charAt(0)
                              .toUpperCase() +
                            currentUser.presence.status.slice(1)
                        : "Offline"}
                    </span>
                  </span>
                </div>{" "}
                <div className="interactions">
                  <button>
                    <FontAwesomeIcon icon={faMessage} />
                  </button>
                  <button>
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                  </button>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>
                <FontAwesomeIcon icon={faIdCard} className="pr-[6px]" />
                Profile
              </ContextMenuItem>
              <ContextMenuItem onClick={() => createPM(currentUser.id)}>
                <FontAwesomeIcon icon={faMessage} className="pr-[7px]" />
                Message
              </ContextMenuItem>
              <ContextMenuItem>
                <FontAwesomeIcon icon={faPhone} className="pr-[7px]" />
                Call
              </ContextMenuItem>
              <hr className="opacity-5 mx-[5px]"></hr>
              <ContextMenuItem
                className="text-red-600"
                onClick={() =>
                  removeFriend(
                    currentUser.username,
                    currentUser.discriminator,
                    setRelationships
                  )
                }
              >
                <FontAwesomeIcon icon={faUserMinus} className="pr-[4px]" />
                Remove Friend
              </ContextMenuItem>
              <ContextMenuItem className="text-red-600">
                <FontAwesomeIcon icon={faBan} className="pr-[7px]" />
                Block
              </ContextMenuItem>
              <hr className="opacity-5 mx-[5px]"></hr>
              <ContextMenuItem onClick={() => copy(currentUser.id)}>
                <FontAwesomeIcon icon={faCopy} className="pr-[8px]" />
                Copy User ID
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
