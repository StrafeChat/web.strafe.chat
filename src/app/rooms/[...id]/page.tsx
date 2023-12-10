"use client";
import { useAuth } from "@/context/AuthContext";
import { Room, useRoom } from "@/context/RoomContext";
import { faPhone, faThumbtack, faVideoCamera } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";

export default function Page({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { pms } = useRoom();
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
          <>
            <div className="header">
              <div className="between">
                <span>@{currentUser?.username}</span>
                <span className="flex gap-5 items-center text-2xl">
                    <FontAwesomeIcon icon={faPhone}/>
                    <FontAwesomeIcon icon={faVideoCamera}/>
                </span>
              </div>
            </div>
          </>
        );
      })();
  }
}
