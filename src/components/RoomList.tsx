import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserGroup,
  faNoteSticky,
  faHouseChimney,
} from "@fortawesome/free-solid-svg-icons";
import { useRoom } from "@/context/RoomContext";
import { usePathname, useRouter } from "next/navigation";

export default function RoomList() {
  const { setTab } = useRoom();

  const router = useRouter();
  const pathname = usePathname();

  return (
    <div>
    <ul className="rooms">
      <div className="header">
        <span>
          <b>Private Messages</b>
        </span>
      </div>
      <li
        className={pathname == "/" ? "active" : ""}
        onClick={() => {
          setTab("home");
          router.push("/");
        }}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faHouseChimney} />
        </span>
        <span className="content">Home</span>
      </li>
      <li
        className={pathname == "/friends" ? "active" : ""}
        onClick={() => {
          setTab("friends");
          router.push("/friends");
        }}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faUserGroup} />
        </span>
        <span className="content">Friends</span>
      </li>
      <li
        className={pathname == "/notes" ? "active" : ""}
        onClick={() => {
          setTab("notes");
          router.push("/notes");
        }}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faNoteSticky} />
        </span>
        <span className="content">Notes</span>
      </li>
       <span className="mt-2.5 pl-4 text-gray-500 font-bold uppercase text-[12px] w-full">
            Conversations
      </span>
    </ul>
    </div>
  );
}
