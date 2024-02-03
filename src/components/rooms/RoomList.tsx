import { useUI } from "@/providers/UIProvider";
import { motion, useAnimation } from "framer-motion";
import localForage from "localforage";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import PrivateMessages from "./PrivateMessageRoomList";
import RoomsNav from "./SpaceRoomList";

// let isMoible = typeof window !== "undefined" && window.innerWidth < 768;

export default function RoomList() {
  const controls = useAnimation();
  const { hideRoomList, setHideRoomList } = useUI();
  const path = usePathname();

  useEffect(() => {
    localForage.getItem<boolean>("hide_room_list").then((hidden) => {
      setHideRoomList(!!hidden);      
    })
  }, [setHideRoomList]);

  useEffect(() => {
    controls.start({ width: hideRoomList ? 0 : "auto" });
    localForage.setItem("hide_room_list", hideRoomList);
    typeof window !== "undefined" && window.dispatchEvent(new Event("hide-sidebar"))
  }, [hideRoomList, controls]);

  const paths = path.trim().split("/").filter((x) => x !== "" && x !== "spaces" && x !== "rooms");


  return (
    <>
      <motion.div
        style={{ width: "100%", overflow: "hidden" }}
        initial={false}
        animate={{ width: hideRoomList ? 0 : "auto"}}
        transition={{ duration: 0.5, ease: "easeIn" }}
      >
        <div className="room-list">
          {(() => {
            switch (path) {
              case "/":
              case "/friends":
              case "/notes":
                return <PrivateMessages />;
              default:
                if (path.startsWith("/rooms")) return <PrivateMessages />;
                if (path.startsWith("/spaces")) return <RoomsNav params={{
                  spaceId: paths[0],
                  rooms: [{ id: "general", name: "general" }, { id: "off-topic", name: "off-topic" }]
                }} />;
                break;
            }
          })()}
        </div>
      </motion.div>
    </>
  );
}
