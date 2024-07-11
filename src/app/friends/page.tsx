"use client";
import { useUI } from "@/providers/UIProvider";
import { FaUserGroup, FaArrowRight, FaArrowLeft } from "react-icons/fa6";
import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { useModal } from "@/hooks";
import { OnlineFriends } from "@/components/friends/OnlineFriends";
import { AllFriends } from "@/components/friends/AllFriends";
import { PendingRequests } from "@/components/friends/PendingRequests";

export default function Friends() {

   const { setHideRoomList, hideRoomList } = useUI();
   const [tab, setTab] = useState("online");
   const { t } = useTranslation();
   const { openModal } = useModal();

   return (
    <>
    <div className="header-container">
      <div className="header">
        <span className="flex items-center gap-[3px]">
          {hideRoomList ? (
            <>
              <FaUserGroup onClick={() => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaUserGroup onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>{t('friends_page.header')}</b></span>
        
        <div className="tabs">
          <button
            className={tab == "online" ? "active" : ""}
            onClick={() => setTab("online")}
          >
            <h3>Online</h3>
          </button>
          <button
            className={tab == "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            <h3>All</h3>
          </button>
          <button
            className={tab == "pending" ? "active" : ""}
            onClick={() => setTab("pending")}
          >
            <h3>Pending</h3>
          </button>
          <button
            className={tab == "blocked" ? "active" : ""}
            onClick={() => setTab("blocked")}
          >
            <h3>Blocked</h3>
          </button>
          <button className="add-friend" onClick={() => openModal("send-friend-request")}>
          <h3>Add Friend</h3>
          </button>
        </div>
      </div>
      {tab == "online" && (
          <OnlineFriends/>
        )}
        {tab == "all" && (
          <AllFriends />
        )}
        {tab == "pending" && (
          <PendingRequests />
        )}
        {/* {tab == "blocked" && (
          <BlockedUsers
            relationships={relationships.filter(
              (relationship) => relationship.status == "blocked"
            )}
          />
        )} */}
    </div>
    </>
   )
}