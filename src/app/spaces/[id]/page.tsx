"use client";
import { useClient } from "@/hooks";
import { useRouter } from "next/navigation";
// import { useUI } from "@/providers/UIProvider";
// import { FaArrowLeft, FaArrowRight, FaHouseChimney } from "react-icons/fa6";

export default function Page({ params }: { params: { id: string } }) {

  // const { hideRoomList, setHideRoomList } = useUI();
   const { client } = useClient();
   const router = useRouter();
   const space = client?.spaces.get(params.id);

   if (!space) return <h1>Space not found.</h1>;

   let last_viewed_room_id = localStorage.getItem(`last_viewed_room-${space.id}`);
    if (!last_viewed_room_id) last_viewed_room_id = space.rooms.toArray().filter(room => [1,  2].includes(room.type))[0].id;
     if (!last_viewed_room_id) return <h1>This space has no created rooms.</h1>

   return router.push(`/spaces/${space.id}/rooms/${last_viewed_room_id}`);
   
  // return (
  //   <>
  //     <div className="header-container">
  //     <div className="header">
  //       <span className="flex items-center justify-between gap-[3px]">
  //         {hideRoomList ? (
  //           <>
  //             <FaHouseChimney onClick={() => setHideRoomList(!hideRoomList)} />
  //             <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
  //           </>
  //         ) : (
  //           <>
  //             <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
  //             <FaHouseChimney onClick={() => setHideRoomList(!hideRoomList)} />
  //           </>
  //         )}
  //       </span>
  //       <span><b>Home</b></span>
  //       </div>
  //     </div>
  //   </>
  // )
}