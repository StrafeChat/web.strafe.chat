"use client";
import { useUI } from "@/providers/UIProvider";
import { FaUserGroup, FaArrowRight, FaArrowLeft } from "react-icons/fa6";

export default function Friends() {

   const { setHideRoomList, hideRoomList } = useUI();

   return (
    <>
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
        <span><b>Friends</b></span>
      </div>
    </>
   )
}