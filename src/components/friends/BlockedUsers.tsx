import { Relationship, User, useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { ContextMenu } from "../ui/context-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Formatting } from "@/scripts/Formatting";

export default function BlockedUsers({
  relationships,
}: {
  relationships: Relationship[];
}) {
  const { user } = useAuth();

  return (
    <div className="friends">
      <span className="count">
        Blocked - {relationships.length}
      </span>
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
                    <span className="username">
                      {currentUser.username}
                    </span>
                    <span className="status">
                      {currentUser.presence.status}
                    </span>
                  </span>
                </div>{" "}
                <div className="interactions"></div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Profile</ContextMenuItem>
              <ContextMenuItem>Unblock</ContextMenuItem>
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
