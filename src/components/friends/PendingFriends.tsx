import { Relationship, User, useAuth } from "@/context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import { ContextMenu } from "../ui/context-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import cookie from "js-cookie";

export default function PendingFriends({
  relationships,
}: {
  relationships: Relationship[];
}) {
  const { user, setRelationships } = useAuth();

  return (
    <div className="p-[2rem] flex flex-col">
      <span className="uppercase font-bold text-gray-500 pb-[7px]">
        Pending - {relationships.length}
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
                      {relationship.receiver_id == user.id
                        ? "Incoming"
                        : "Outgoing"}{" "}
                      Friend Request
                    </span>
                  </span>
                </div>{" "}
                <div className="flex w-fit items-center">
                  <button
                    onClick={async () => {
                      if (relationship.receiver_id == user.id) {
                        const res = await fetch(
                          `${process.env.NEXT_PUBLIC_API}/users/@me/relationships/${relationship.sender.username}-${relationship.sender.discriminator}`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: cookie.get("token")!,
                            },
                            body: JSON.stringify({
                              action: "accept",
                            }),
                          }
                        );

                        const data = await res.json();

                        if (!res.ok) return console.log(data);

                        setRelationships((prev) => {
                          const updatedRelationships = prev.map(
                            (relationship) => {
                              if (
                                relationship.receiver_id ===
                                  data.relationship.receiver_id &&
                                relationship.sender_id ===
                                  data.relationship.sender_id
                              ) {
                                return {
                                  ...relationship,
                                  status: "accepted",
                                } as Relationship;
                              }
                              return relationship;
                            }
                          );

                          return updatedRelationships;
                        });
                      } else if (relationship.sender_id == user.id) {
                        const res = await fetch(
                          `${process.env.NEXT_PUBLIC_API}/users/@me/relationships/${relationship.receiver.username}-${relationship.receiver.discriminator}`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: cookie.get("token")!,
                            },
                            body: JSON.stringify({
                              action: "reject",
                            }),
                          }
                        );

                        const data = await res.json();

                        if (!res.ok) return console.log(data);

                        setRelationships((prev) =>
                          prev.filter(
                            (relationship) =>
                              relationship.receiver_id !=
                                data.relationship.receiver_id &&
                              relationship.sender_id !=
                                data.relationship.receiver_id
                          )
                        );
                      }
                    }}
                    className="text-white bg-gray-700 w-[30px] h-[30px] rounded-full flex items-center justify-center"
                  >
                    {relationship.receiver_id == user.id ? (
                      <FontAwesomeIcon
                        className="w-[24px] h-[24px]"
                        icon={faCheck}
                      />
                    ) : (
                      <FontAwesomeIcon
                        className="w-[24px] h-[24px]"
                        icon={faXmark}
                      />
                    )}
                  </button>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Profile</ContextMenuItem>
              <ContextMenuItem>Message</ContextMenuItem>
              <ContextMenuItem>Call</ContextMenuItem>
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
