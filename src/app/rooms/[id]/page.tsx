"use client";
import { useAuth } from "@/context/AuthContext";
import { Room, useRoom } from "@/context/RoomContext";
import { faPhone, faThumbtack, faVideoCamera } from "@fortawesome/free-solid-svg-icons";
import ChatBox from "@/components/room/ChatBox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Metadata } from "next";
import { useEffect, useState, useRef } from "react";

export default function Page({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { pms } = useRoom();
  const scrollRef = useRef<HTMLUListElement>(null);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  useEffect(() => {
    setCurrentRoom(pms.find((pm) => pm.id == params.id) ?? null);
  }, [params, pms]);

  switch (currentRoom?.type) {
    case 0:
      return (() => {
        const currentUser = currentRoom.recipients!.find(
          (recipient) => recipient.id != user.id
        );
        return (
          <div className="h-full pb-[50px]">
            <div className="header">
              <div className="between">
                <span><b>@{currentUser?.username}</b></span>
                <span className="flex gap-5 items-center text-2xl">
                    <FontAwesomeIcon icon={faPhone}/>
                    <FontAwesomeIcon icon={faVideoCamera}/>
                </span>
            </div>
          </div>
        <div className="flex min-w-[5px] h-full flex-col justify-end">
        <ul ref={scrollRef} className="overflow-y-auto w-full flex flex-col scrollbar-thin scrollbar-thumb-[#737d3c] scrollbar-thumb-rounded-full scrollbar-track-transparent relative break-all">
        <div className="py-[25px] pl-[15px] text-white">
              <h2 className="text-[27px] font-bold">
                  @
                  {currentUser?.username}
              </h2>
              <p>This is the start of your conversation.</p>
            </div>
        </ul>
      <ChatBox room={currentRoom} />
       </div>
     </div>
      );
   })();
  }
}
