"use client";
import { useUI } from "@/providers/UIProvider";
import { FaNoteSticky } from "react-icons/fa6";

export default function Page() {

   const { hideRoomList, setHideRoomList } = useUI();

   return (
      <>
         <div className="header">
            <FaNoteSticky onClick={(event: MouseEvent) => setHideRoomList(!hideRoomList)} />
            <span>Notes</span>
         </div>
      </>
   )
}