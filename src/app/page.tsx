"use client";
import { useUI } from "@/providers/UIProvider";
import { FaHouseChimney, FaArrowLeft, FaArrowRight } from 'react-icons/fa6';

export default function Home() {

  const { hideRoomList, setHideRoomList } = useUI();

  return (
     <>
      <div className="header">
        <span className="flex items-center gap-[3px]">
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
    </>
  );
}
