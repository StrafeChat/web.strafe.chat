"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import AddFriendModal from "@/components/modals/AddFriendModal";
import { User, useAuth } from "@/context/AuthContext";
import PendingFriends from "@/components/friends/PendingFriends";
import AllFriends from "@/components/friends/AllFriends";
import OnlineFriends from "@/components/friends/OnlineFriends";
import BlockedUsers from "@/components/friends/BlockedUsers";

export default function Friends() {
  const [tab, setTab] = useState("online");
  const [showAddFriend, setShowAddFriend] = useState(false);

  const { user, relationships } = useAuth();

  return (
    <>
      <div className="header">
        <h1 className="title">
          <FontAwesomeIcon icon={faUserGroup} />
          &nbsp;&nbsp;<b>Friends</b>
        </h1>
        <div className="tabs">
          <button
            className={tab == "online" ? "active" : ""}
            onClick={() => setTab("online")}
          >
            Online
          </button>
          <button
            className={tab == "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            All
          </button>
          <button
            className={tab == "pending" ? "active" : ""}
            onClick={() => setTab("pending")}
          >
            Pending
          </button>
          <button
            className={tab == "blocked" ? "active" : ""}
            onClick={() => setTab("blocked")}
          >
            Blocked
          </button>
          <button className="add-friend" onClick={() => setShowAddFriend(true)}>
            Add Friend
          </button>
        </div>
      </div>
      <div className="body">
        {tab == "online" && (
          <OnlineFriends
            relationships={relationships.filter((relationship) => {
              const currentUser: User =
                relationship.receiver_id != user.id
                  ? relationship.receiver
                  : relationship.sender;

              return (
                relationship.status == "accepted" &&
                (currentUser.presence.online && currentUser.presence.status != "offline")
              );
            })}
          />
        )}
        {tab == "all" && (
          <AllFriends
            relationships={relationships.filter(
              (relationship) => relationship.status == "accepted"
            )}
          />
        )}
        {tab == "pending" && (
          <PendingFriends
            relationships={relationships.filter(
              (relationship) => relationship.status == "pending"
            )}
          />
        )}
        {tab == "blocked" && (
          <BlockedUsers
            relationships={relationships.filter(
              (relationship) => relationship.status == "blocked"
            )}
          />
        )}
      </div>
      <AddFriendModal show={showAddFriend} set={setShowAddFriend} />
    </>
  );
}
