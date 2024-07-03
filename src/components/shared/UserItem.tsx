import { useClient } from "@/hooks";
import ProfilePopup from "../popup/ProfilePopup";
import { useEffect, useState } from "react";
import { IUser } from "@strafechat/strafe.js";
import { Formatting } from "@/helpers/formatter";

export interface UserItemProps {
  user?: IUser;
}

export function UserItem(props: UserItemProps) {
  const { client } = useClient();

  if (!client) return null;
  if (!props.user) return null;

  const [user, setUser] = useState<IUser | null>(null);

  // NOTE: Either set user or userId
  useEffect(() => {
    if (props.user) return setUser(props.user);
  }, []);

  if (!user) return null;

  console.log(user);

  // TODO: add loading screen
  return (
    <ProfilePopup user={user} client={client}>
        <li style={{
          marginLeft: "2rem"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}>
            <div style={{
              position: "relative",
              verticalAlign: "middle",
            }}>
              <img draggable={false} src={`${Formatting.formatAvatar(user.id, user.avatar)}`} alt="Avatar" style={{
                maxWidth: "1.2rem",
                aspectRatio: "1/1",
                borderRadius: "50%",
                marginRight: "0.3rem"
              }}></img>
            </div>
            <span className="username">{user.global_name ?? user.username}</span>
          </div>          
        </li>
     </ProfilePopup>
  )
}