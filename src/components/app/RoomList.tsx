import { useUI } from "@/providers/UIProvider"
import PrivateMessages from "../rooms/PrivateMessages";
import { usePathname } from "next/navigation";

export default function RoomList() {

   const { electron } = useUI();

   const path = usePathname();

   return (
      <div className="room-list" {...{ "electron": `${electron}` }}>
         {(() => {
            switch (path) {
               case "/":
               case "/friends":
               case "/notes":
                  return <PrivateMessages />;
               default:
                  if(path.startsWith("/rooms")) return <PrivateMessages />
                  break;
            }
         })()}
      </div>
   )
}