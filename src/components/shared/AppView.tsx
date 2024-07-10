"use client"
import { useUI } from "@/providers/UIProvider";
import { ReactNode, useState } from "react";
export function AppView({ children }: { children: JSX.Element | ReactNode }) {
   let [hidden, setHidden] = useState(false)
   const { hideRoomList } = useUI();

   window.addEventListener('hide-sidebar', () => {
      setHidden(!hidden)
   })
   return (
      <div
         className="app-view overflow-hidden">
         {children}
      </div>
   )
}