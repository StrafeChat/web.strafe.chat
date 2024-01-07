"use client";
import { useUI } from "@/providers/UIProvider";
import { FaNoteSticky, FaArrowRight, FaArrowLeft } from "react-icons/fa6";

export default function Notes() {

   const { hideRoomList, setHideRoomList } = useUI();

   return (
    <>
      <div className="header">
        <span className="flex items-center gap-[3px]">
          {hideRoomList ? (
            <>
              <FaNoteSticky onClick={(event: MouseEvent) => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaNoteSticky onClick={(event: MouseEvent) => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>Notes</b></span>
      </div>
    </>
   )
}