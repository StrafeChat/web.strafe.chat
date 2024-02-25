import { useClient, useModal } from "@/hooks";
import Link from "next/link";
import { useState } from "react";
import { FaCompass, FaGear, FaPenToSquare, FaPlus } from "react-icons/fa6";
import { NavLink } from "../shared";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../ui/context-menu";
let isMobile = typeof window !== "undefined" && window.innerWidth < 768;
typeof window !== "undefined" && window.addEventListener("resize", () => {
   isMobile = window.innerWidth < 768;
});
export default function SpaceList() {
   let [hide, setHide] = useState(false);
   const { openModal } = useModal();
   const { client } = useClient();

   if (typeof window !== "undefined" && isMobile) {
      window.addEventListener("hide-sidebar", () => {
         setHide(!hide);
      });
   } 

   return (
      <div className="space-list"
         style={{ display: hide && isMobile ? "" : "" }}
      >
         <ContextMenu>
            <ContextMenuTrigger>
               <NavLink href="/" activate={["/friends", "/notes", "/rooms"]}>
                  <button>
                     <img src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${client?.user?.id}/${client?.user?.avatar}`} className="avatar" alt="Avatar"></img>
                     <div className={`avatar-status ${client?.user?.presence.status}`}></div>
                  </button>
               </NavLink>
            </ContextMenuTrigger>
            <ContextMenuContent>
               <ContextMenuItem onClick={() => openModal("settings")} className="flex gap-2 items-center"><FaGear className="w-3 h-3 rounded-full" /> Settings</ContextMenuItem>
               <hr />
               <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "online" })}><div className="user-status online" /> Online</ContextMenuItem>
               <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "idle" })}><div className="user-status idle" />Idle</ContextMenuItem>
               <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "coding" })}><div className="user-status coding" />Coding</ContextMenuItem>
               <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "dnd" })}><div className="user-status dnd" />Do Not Disturb</ContextMenuItem>
               <ContextMenuItem onClick={() => client?.user?.setPresence({ status: "offline" })}><div className="user-status offline" />Invisible</ContextMenuItem>
               <hr />
               <ContextMenuItem onClick={() => openModal("status")}><FaPenToSquare className="w-3 h-3" /> Custom Status</ContextMenuItem>
            </ContextMenuContent>
         </ContextMenu>
         <div className="seperator" />
         <div className="spaces">
            {client?.spaces.map((space) => (
                <div>
                   <NavLink href={`/spaces/${space.id}`}>
                  <button className="space" draggable={true}>
                    {
                      space.icon ? (
                         <img className="space" src={space.icon} alt="Space Icon" />
                      ) : (
                         <>{space.nameAcronym}</>
                      )
                    }
                 </button>
               </NavLink>
            </div>
           ))}
         </div>

         <div className="seperator" />

         <button className="primary" onClick={() => openModal("create-space")}>
            <FaPlus />
         </button>
         <button className="primary disabled">
            <FaCompass />
         </button>
         <button className="primary" onClick={() => openModal("settings")}>
            <FaGear />
         </button>
      </div>
   )
}