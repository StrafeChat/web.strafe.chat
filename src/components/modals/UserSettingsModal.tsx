import { User, useAuth } from "@/context/AuthContext";
import { faXmarkCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import AccountSettings from "../settings/AccountSettings";

export default function UserSettingsModal({
  show,
  set,
}: {
  show: boolean;
  set: Dispatch<SetStateAction<boolean>>;
}) {
  const { user, setUser } = useAuth();
  const [currentSetting, setCurrentSetting] = useState("account");

  useEffect(() => {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") set(false);
    });
  }, [set]);

  return show ? (
    <div className="modal">
      <div className="no-backdrop">
        <div className="wrapper">
          <div className="sidebar">
          <p style={{ color: "grey", fontSize: "10px"}}>USER SETTINGS</p>
            <ul>
              <li
                onClick={() => setCurrentSetting("account")}
                className={currentSetting == "account" ? "active" : ""}
              >
               My Account
              </li>
              <li
                onClick={() => setCurrentSetting("profile")}
                className={currentSetting == "profile" ? "active" : ""}
              >
                Profile
              </li>
            </ul>
          </div>
          <div className="settings">
            <div className="header">
              <h1 className="title">{currentSetting}</h1>
              <button onClick={() => set(false) }>
              <FontAwesomeIcon icon={faXmarkCircle} className="text-white mt-8 w-6 h-6"/>
              <br></br>
             <span className="text-white"> ESC </span>
              </button>
            </div>
            <div className="body">
              {currentSetting == "account" && <AccountSettings user={user} setUser={setUser} />}
              {currentSetting == "profile" && <></>}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <></>
  );
}
