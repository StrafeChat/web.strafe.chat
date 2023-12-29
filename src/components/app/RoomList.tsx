import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { useUI } from "@/providers/UIProvider";
import PrivateMessages from "../rooms/PrivateMessages";
import { usePathname } from "next/navigation";
import localForage from "localforage";

export default function RoomList() {
  const controls = useAnimation();
  const { hideRoomList, setHideRoomList } = useUI();
  const path = usePathname();

  useEffect(() => {
    localForage.getItem<boolean>("hide_room_list").then((hidden) => {
      setHideRoomList(!!hidden);
    })
  }, []);

  useEffect(() => {
    controls.start({ width: hideRoomList ? 0 : "auto" });
    localForage.setItem("hide_room_list", hideRoomList);
  }, [hideRoomList, controls]);

  return (
    <>
      <motion.div
        style={{ width: "100%", overflow: "hidden" }}
        initial={false}
        animate={{ width: hideRoomList ? 0 : "auto" }}
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
                break;
            }
          })()}
        </div>
      </motion.div>
    </>
  );
}
