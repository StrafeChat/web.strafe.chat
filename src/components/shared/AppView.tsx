"use client"
import { useUI } from "@/providers/UIProvider";
import { ReactNode, useState } from "react";
let isMobile = typeof window !== "undefined" ?  window.innerWidth < 768 : false
export function AppView({ children }: { children: JSX.Element | ReactNode }) {
   let [hidden, setHidden] = useState(false)
   const { hideRoomList } = useUI();

   window.addEventListener('hide-sidebar', () => {
      setHidden(!hidden)
   })
   return (
      <div

         className="app-view" {...{ "room_list_hidden": `${hideRoomList}` }}>
         {children}
      </div>
   )
}