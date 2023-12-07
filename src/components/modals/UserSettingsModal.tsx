import { User, useAuth } from "@/context/AuthContext";
import { XSquare } from "lucide-react";
import Image from "next/image";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

export default function UserSettingsModal({
  show,
  set,
}: {
  show: boolean;
  set: Dispatch<SetStateAction<boolean>>;
}) {
  const { user } = useAuth();
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
              <button onClick={() => set(false)}>
                <XSquare className="close" />
              </button>
            </div>
            <div className="body">
              {currentSetting == "account" && <AccountSettings user={user} />}
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

function AccountSettings({ user }: { user: User }) {
  return (
    <>
      {/* <div className="account-card">
        {user.banner ? (
          <div
            style={{
              background: "#" + user.accent_color.toString(16).padStart(6, "0"),
            }}
            className="banner"
          />
        ) : (
          <div></div>
        )}
        <div className="wrapper">
          <div className="avatar-container">
            <Image
              className="avatar"
              draggable={false}
              src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${user.avatar}.png`}
              alt="profile"
              width={72}
              height={72}
            />
          </div>
        </div>
        <div className="flex absolute left-[9rem] w-[90%] justify-between">
          <span onClick={() => navigator.clipboard.writeText(user.id)} className="text-lg text-white p-1 mt-1 hover:bg-black cursor-pointer rounded-xl h-fit">{user.username}#{user.discriminator}</span>
          <button className="m-2 p-2 rounded-xl bg-red-500">Edit Profile</button>
        </div>
      </div> */}
      <div className="account-card">
        <div className="banner-container">
          <div className="wrapper">
            <div
              style={{
                background:
                  "#" + user.accent_color.toString(16).padStart(6, "0"),
              }}
              className="banner"
            />
          </div>
          <div className="header">
            <div className="placeholder" />
            <Image
              width={80}
              height={80}
              style={{ objectFit: "cover", width: "80px", height: "80px" }}
              src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${user.avatar}.png`}
              className="avatar"
              alt="profile picture"
              draggable={false}
            />
          </div>
          <p className="username">
            {user.username}#{user.discriminator}
          </p>
        </div>
        <div className="body"></div>
      </div>
    </>
  );
}
