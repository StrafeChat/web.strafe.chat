"use client";
import { useClient } from "@/hooks";
import { useUI } from "@/providers/UIProvider";
import { FaArrowLeft, FaArrowRight, FaHouseChimney } from "react-icons/fa6";

export default function Page({ params }: { params: { id: string, roomId: string } }) {

  const { hideRoomList, setHideRoomList } = useUI();
  const { client } = useClient();

  return (
    <>
      <div className="header-container">
      <div className="header">
        <span className="flex items-center justify-between gap-[3px]">
          {hideRoomList ? (
            <>
              <FaHouseChimney onClick={() => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaHouseChimney onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>Home</b></span>
        </div>
      </div>
    </>
  )
}