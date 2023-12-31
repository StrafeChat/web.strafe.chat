import { User } from "@/context/AuthContext";
import {
  faEnvelope,
  faHashtag,
  faKey,
  faSignature,
  faTag,
  faX,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import cookie from "js-cookie";
import { useToast } from "@/components/ui/use-toast"
import { Formatting } from "@/scripts/Formatting";

export const dynamic = "force-dynamic";

export default function AccountSettings({
  user,
  setUser,
}: {
  user: User;
  setUser: Dispatch<SetStateAction<User>>;
}) {
  const [currentData, setCurrentData] = useState<Partial<User>>({
    avatar: Formatting.avatar(user.id, user.avatar),
    email: `${user.email}`,
    username: `${user.username}`,
    discriminator: user.discriminator,
    global_name: user.global_name
  });
  const [data, setData] = useState(currentData);
  const [updated, setUpdated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (JSON.stringify(currentData) != JSON.stringify(data)) {
      setUpdated(true);
    } else setUpdated(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleSave = async () => {
    if (!updated) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API}/users/@me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: cookie.get("token")!,
      },
      body: JSON.stringify({
        username: data.username != currentData.username ? data.username : null,
        discriminator: data.discriminator != currentData.discriminator ? data.discriminator : null,
        avatar: data.avatar != currentData.avatar ? data.avatar : null,
        global_name: data.global_name != currentData.global_name ? data.global_name : null
      }),
    });

    const fetched = await res.json();

    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "SAVE ERROR",
        description: fetched.message || "An error occurred while saving.",
      })
      setUpdated(false);
      return;
    }

    if (res.ok) {
      toast({
        title: "SAVED",
        description: "Your changes have been saved.",
      })
      setUpdated(false);
      return window.location.reload();
    }

    // setCurrentData({
    //   ...data,
    //   avatar: `${process.env.NEXT_PUBLIC_CDN}/avatars/${user.avatar}`.replace(
    //     /_png$/,
    //     ".png"
    //   ),
    // });
    // setUser({
    //   ...user,
    //   ...data,
    //   avatar: user.avatar,
    // });
  };

  return (
    <>
      {updated && (
        <button
          className="absolute bottom-2.5 right-5 bg-red-500 p-1 rounded-xl"
          onClick={handleSave}
        >
          SAVE
        </button>
      )}
      <div className="flex justify-center">
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
              <div className="group">
                <div className="placeholder" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${data.avatar}`}
                  className="avatar z-[1000]"
                  draggable={false}
                  alt="profile picture"
                  width={80}
                  height={80}
                  style={{ objectFit: "cover", width: "80px", height: "80px" }}
                />
                <input
                  type="file"
                  accept="image/png, image/gif, image/jpeg"
                  className="avatar group-hover:opacity-80 z-[1001]"
                  onChange={(event) => {
                    if (event.target.files) {
                      if (event.target.files.length > 0) {
                        let reader = new FileReader();
                        reader.readAsDataURL(event.target.files[0]);
                        reader.onload = (loaded) => {
                          setData({
                            ...data,
                            avatar: loaded.target?.result?.toString()!,
                          });
                        };
                      }
                    }
                  }}
                />
              </div>
              {currentData.avatar != data.avatar && updated && (
                <button
                  className="absolute top-[4rem] left-[5rem] bg-red-500 w-[32px] h-[32px] flex justify-center items-center rounded-full border border-black"
                  onClick={() =>
                    setData({ ...data, avatar: currentData.avatar })
                  }
                >
                  <FontAwesomeIcon icon={faX} />
                </button>
              )}
            </div>
            <p className="username">
              {currentData.username}#
              {currentData.discriminator!.toString().padStart(4, "0")}
            </p>
          </div>
          <div className="body">
            <div className="mt-10">
              <div className="flex flex-col gap-4">
                <div className="input">
                  <span className="icon">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </span>
                  <div className="info">
                    <span className="title">Email</span>
                    <span className="content">
                      {"•".repeat(currentData.email!.split("@")[0].length)}@
                      {currentData.email!.split("@")[1]}
                    </span>
                  </div>
                </div>
                <div className="input">
                  <span className="icon">
                    <FontAwesomeIcon icon={faSignature} />
                  </span>
                  <div className="info">
                    <span className="title">Username</span>
                    <span
                      className="content outline-none"
                      placeholder={currentData.username}
                      spellCheck={false}
                      contentEditable={true}
                      suppressContentEditableWarning
                      onKeyDown={(event) => {
                        if (event.key == "Enter") event.preventDefault();
                      }}
                      onInput={(event) => {
                        setData({
                          ...data,
                          username: (event.target as HTMLSpanElement).innerText,
                        });
                      }}
                    >
                      {currentData.username}
                    </span>
                  </div>
                </div>
                <div className="input">
                  <span className="icon">
                    <FontAwesomeIcon icon={faHashtag} />
                  </span>
                  <div className="info">
                    <span className="title">Discriminator</span>
                    <span
                      className="content outline-none"
                      placeholder={`${currentData.discriminator}`}
                      spellCheck={false}
                      contentEditable={true}
                      suppressContentEditableWarning
                      onKeyDown={(event) => {
                        if (event.key == "Enter") return event.preventDefault();
                        if ((event.target as HTMLSpanElement).innerText.length > 3 && event.key != "Backspace") return event.preventDefault();
                        if (isNaN(parseInt(event.key)) && event.key != "Backspace") return event.preventDefault();
                      }}
                      onInput={(event) => {
                        setData({ ...data, discriminator: parseInt((event.target as HTMLSpanElement).innerText) });
                      }}
                    >
                      {currentData.discriminator}
                    </span>
                  </div>
                </div>
                <div className="input">
                  <span className="icon">
                    <FontAwesomeIcon icon={faTag} />
                  </span>
                  <div className="info">
                    <span className="title">Display Name</span>
                    <span
                      className="content outline-none"
                      placeholder={`${currentData.global_name ?? "No Display Name"}`}
                      spellCheck={false}
                      contentEditable={true}
                      suppressContentEditableWarning
                      onKeyDown={(event) => {
                        if (event.key == "Enter") event.preventDefault();
                      }}
                      onInput={(event) => {
                        setData({
                          ...data,
                          global_name: (event.target as HTMLSpanElement).innerText,
                        });
                      }}
                    >
                      {currentData.global_name ?? ""}
                    </span>
                  </div>
                </div>
                <div className="input">
                  <span className="icon">
                    <FontAwesomeIcon icon={faKey} />
                  </span>
                  <div className="info">
                    <span className="title">Password</span>
                    <span
                      className="content outline-none"
                      placeholder="•••••••••"
                      contentEditable
                      onKeyDown={(event) => {
                        if (event.key == "Enter") event.preventDefault();
                      }}
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
