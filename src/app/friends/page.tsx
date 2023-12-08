"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import AddFriendModal from "@/components/modals/AddFriendModal";

export default function Friends() {
  const [tab, setTab] = useState("online");
  const [showAddFriend, setShowAddFriend] = useState(false);

  return (
    <>
      <div className="friends">
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
            <button
              className="add-friend"
              onClick={() => setShowAddFriend(true)}
            >
              Add Friend
            </button>
          </div>
        </div>
      </div>
      <AddFriendModal show={showAddFriend} set={setShowAddFriend} />
    </>
  );
}
