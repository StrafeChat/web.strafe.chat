import { useUI } from "@/providers/UIProvider";
import { ReactNode } from "react";

export function AppView({ children }: { children: JSX.Element | ReactNode }) {

   const { hideRoomList } = useUI();

   return (
      <div className="app-view" {...{"room_list_hidden": `${hideRoomList}`}}>
         {children}
      </div>
   )
}