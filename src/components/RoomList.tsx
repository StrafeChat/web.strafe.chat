import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserGroup,
  faNoteSticky,
  faHouseChimney,
} from "@fortawesome/free-solid-svg-icons";
import { useRoom } from "@/context/RoomContext";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export default function RoomList() {
  const { user } = useAuth();
  const { setTab, pms } = useRoom();

  const router = useRouter();
  const pathname = usePathname();

  console.log(pms);

  return (
    <ul className="rooms-wrapper">
      <div className="header">
        <span>
          <b>Private Messages</b>
        </span>
      </div>
      <div className="rooms-container">
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
        <span className="convo-title">Conversations</span>
        <ul className="rooms">
          {pms.length == 0 && <div className="w-full p-2">No Pms</div>}

          {pms.map((pm, key) => {
            switch (pm.type) {
              case 0:
                const currentUser = pm.recipients?.find(
                  (recipient) => recipient.id != user.id
                );
                return (
                  <li onClick={() => router.push(`/rooms/${pm.id}`)} key={key}>
                    <Image
                      className="avatar"
                      src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${currentUser?.avatar}.png`}
                      width={32}
                      height={32}
                      alt="profile"
                    />
                    <span className="content">
                      <span className="username">{currentUser?.username}</span>
                      <span className="status-text">
                        {user.presence.status_text}
                      </span>
                    </span>
                  </li>
                );
            }
          })}
        </ul>
      </div>
    </ul>
  );
}
