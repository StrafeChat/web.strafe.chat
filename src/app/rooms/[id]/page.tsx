"use client";
import { useUI } from "@/providers/UIProvider";
import { FaAt, FaArrowLeft, FaArrowRight } from 'react-icons/fa6';

export default function PrivateMessage({ params }: { params: { id: string } }) {

  const { hideRoomList, setHideRoomList } = useUI();

  return (
     <>
      <div className="header">
        <span className="flex items-center gap-[3px]">
          {hideRoomList ? (
            <>
              <FaAt onClick={() => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaAt onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>{params.id}</b></span>
      </div>
    </>
  );
}
