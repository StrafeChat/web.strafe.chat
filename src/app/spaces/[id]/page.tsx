"use client";
import { useUI } from "@/providers/UIProvider";
import { FaArrowRight, FaArrowLeft, FaHouseChimney } from "react-icons/fa6";

export default function Page({ params }: { params: { id: string, roomId: string } }) {

   const { hideRoomList, setHideRoomList } = useUI();

   return (
    <>
      <div className="header">
        <span className="flex items-center gap-[3px]">
          {hideRoomList ? (
            <>
              <FaHouseChimney onClick={(event: MouseEvent) => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaHouseChimney onClick={(event: MouseEvent) => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>{params.id}</b></span>
      </div>
    </>
   )
}