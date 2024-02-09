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
   console.log(`mobile user: ${isMobile}`);
   return (
      <div className="space-list"
         style={{ display: hide && isMobile ? "none" : "" }}
      >
         <ContextMenu>
            <ContextMenuTrigger>
               <NavLink href="/" activate={["/friends", "/notes", "/rooms"]}>
                  <button>
                     {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <div>
               <NavLink href="/spaces/Strafe">
                  <button className="space">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img className="space" src="https://cdn.discordapp.com/icons/1125943618876735500/03625cebd9f4304c834c07625f2a4f1e.webp?size=4096" alt=""></img>
                  </button>
               </NavLink>
            </div>
            <div>
               <NavLink href="/spaces/trumpfanclub">
                  <button className="space">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img className="space" src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fmedia.kjzz.org%2Fs3fs-public%2Fdonald-trump-170818.jpg&f=1&nofb=1&ipt=0fa3dab62d6f1302ce1b234302429284a4e5b0128a3bcc8913daf08bfbd7465f&ipo=images" alt=""></img>
                  </button>
               </NavLink>
            </div>
            {client?.spaces.map((space) => (
                <div>
                   <NavLink href={`/spaces/${space.id}`}>
                  <button className="space">
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                     {space.name_acronym}
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