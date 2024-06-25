import { useClient, useModal } from "@/hooks";
import Link from "next/link";
import { useState } from "react";
import { FaCirclePlus, FaCompass, FaFolderPlus, FaGear, FaPenToSquare, FaPlus, FaRightFromBracket, FaUserPlus } from "react-icons/fa6";
import { NavLink } from "../shared";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../ui/context-menu";
import { Formatting } from "@/helpers/formatter";
export default function SpaceList() {
   let [hide, setHide] = useState(false);
   const { openModal } = useModal();
   const { client } = useClient();


   return (
      <div className="space-list">
         <ContextMenu>
            <ContextMenuTrigger>
               <NavLink href="/" activate={["/friends", "/notes", "/rooms"]}>
                  <button>
                  <img
                    src={`${Formatting.formatAvatar(client?.user?.id, client?.user?.avatar)}`}
                    onError={() => console.log("Error fetching avatar.")}
                    className="avatar"
                    alt="Avatar"                  />
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
         <div key="spaces" className="spaces">
            {client?.spaces.map((space) => (
          <ContextMenu>
             <ContextMenuTrigger>
                <div key={space.id}>
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
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem className="flex gap-2 items-center disabled"> Mark As Read</ContextMenuItem>
                  <hr />
                   <ContextMenuItem onClick={() => openModal("create-invite", { spaceId: space?.id })} className="flex gap-2 items-center"><FaUserPlus /> Invite People</ContextMenuItem>
                   {space.ownerId == client?.user?.id && (
                   <>
                     <hr />
                     <ContextMenuItem onClick={() => openModal("space-settings", { spaceId: space?.id })} className="flex gap-2 items-center"><FaGear /> Settings</ContextMenuItem>
                     <ContextMenuItem onClick={() => openModal("create-room", { spaceId: space?.id })} className="flex gap-2 items-center"><FaCirclePlus /> Create Room</ContextMenuItem>
                     <ContextMenuItem onClick={() => openModal("create-section", { spaceId: space?.id })} className="flex gap-2 items-center"><FaFolderPlus /> Create Section</ContextMenuItem>
                   </>
                   )}
                  <hr />
                 {space.ownerId !== client?.user?.id && (
                   <ContextMenuItem onClick={() => openModal("leave-space", { spaceId: space?.id })} className={`flex items-center pl-2 p-1.5 hover:bg-red-500 rounded cursor-pointer text-red-500`}><FaRightFromBracket /> Leave Space</ContextMenuItem>
                 )}
                </ContextMenuContent>
              </ContextMenu>
           ))}
         </div>

         <div className="seperator" />

         <button className="primary" onClick={() => openModal("create-space")}>
            <FaPlus />
         </button>
         <button className="primary disabled">
            <FaCompass />
         </button>
      </div>
   );
}