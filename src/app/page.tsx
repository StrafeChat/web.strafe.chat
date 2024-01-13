"use client";
import { useUI } from "@/providers/UIProvider";
import { FaHouseChimney, FaArrowLeft, FaArrowRight } from 'react-icons/fa6';
import { useClient } from "@/controllers/client/ClientController";

export default function Home() {

  const { hideRoomList, setHideRoomList } = useUI();
  const client = useClient();
console.log(client);

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
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-2xl font-bold">Welcome to StrafeChat!</p>
        <p className="text-lg">Hey {client.client?.user?.username}, take a look around.</p>
      </div>
    </>
  );
}
