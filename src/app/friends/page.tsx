"use client";
import { useUI } from "@/providers/UIProvider";
import { FiUsers } from "react-icons/fi";

export default function Page() {

   const { setHideRoomList, hideRoomList } = useUI();

   return (
      <>
         <div className="header">
            <FiUsers onClick={(event: MouseEvent) => setHideRoomList(!hideRoomList)} />
            <span>Friends</span>
         </div>
      </>
   )
}