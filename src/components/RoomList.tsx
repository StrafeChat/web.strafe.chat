import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserGroup, faNoteSticky } from "@fortawesome/free-solid-svg-icons";
import { useRoom } from "@/context/RoomContext";

export default function RoomList() {
  const { tab, setTab } = useRoom();

  return (
    <ul className="rooms">
      <div className="header">
        <span>
          <b>Private Messages</b>
        </span>
      </div>
      <li className={tab == "friends" ? "active" : ""} onClick={() => setTab("friends")}>
        <FontAwesomeIcon className="icon" icon={faUserGroup} />
        <span className="content">Friends</span>
      </li>
      <li className={tab == "notes" ? "active" : ""} onClick={() => setTab("notes")}>
        <FontAwesomeIcon className="icon" icon={faNoteSticky} />
        <span className="content">&nbsp;&nbsp;Notes</span>
      </li>
      <li className={tab == "test" ? "active" : ""} onClick={() => setTab("test")}>
        <FontAwesomeIcon className="icon" icon={faNoteSticky} />
        <span className="content">&nbsp;&nbsp;TEST</span>
      </li>
    </ul>
  );
}
