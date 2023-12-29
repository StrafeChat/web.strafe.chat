"use client";
import ChatInput from "@/components/rooms/ChatInput";
import { useUI } from "@/providers/UIProvider";
import { FaAt, FaArrowLeft, FaArrowRight, FaMagnifyingGlass, FaPhoneVolume } from 'react-icons/fa6';

export default function Page({ params }: { params: { id: string } }) {

  const { hideRoomList, setHideRoomList } = useUI();

  return (
    <>
      <div className="header flex justify-between items-center">
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
          <b className="pl-2">{params.id}</b>
        </span>
        <span className="flex gap-3 items-center text-2xl ml-1">
          <FaPhoneVolume />
          <FaMagnifyingGlass />
        </span>
      </div>
      <div className="body">
        <ul className="messages"></ul>
      </div>
      <ChatInput placeholder={`Message @${params.id}`} />
    </>
  );
}
