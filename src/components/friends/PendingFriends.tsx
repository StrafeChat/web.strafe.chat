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
import { Formatting } from "@/scripts/Formatting";

export default function PendingFriends({
  relationships,
}: {
  relationships: Relationship[];
}) {
  const { user, setRelationships } = useAuth();

  return (
    <div className="friends">
      <span className="count">Pending - {relationships.length}</span>
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="avatar"
                    src={Formatting.avatar(currentUser.id, currentUser.avatar)}
                    width={40}
                    height={40}
                    alt="profile"
                  />
                  <span>
                    <span className="username">{currentUser.username}</span>
                    <span className="status">
                      {relationship.receiver_id == user.id
                        ? "Incoming"
                        : "Outgoing"}{" "}
                      Friend Request
                    </span>
                  </span>
                </div>{" "}
                <div className="interactions">
                  {relationship.receiver_id == user.id && (
                    <button
                      onClick={async () => {
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
                      }}
                    >
                      <FontAwesomeIcon
                        className="w-[24px] h-[24px]"
                        icon={faCheck}
                      />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const res = await fetch(
                        `${process.env.NEXT_PUBLIC_API}/users/@me/relationships/${currentUser.username}-${currentUser.discriminator}`,
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
                      
                      setRelationships((prev) =>
                        prev.filter(
                          (relationship) =>
                            relationship.receiver_id !=
                              data.relationship.receiver_id &&
                            relationship.sender_id !=
                              data.relationship.receiver_id
                        )
                      );
                    }}
                  >
                    <FontAwesomeIcon
                      className="w-[24px] h-[24px]"
                      icon={faXmark}
                    />
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
