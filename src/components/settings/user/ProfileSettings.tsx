import { useClient, useForceUpdate, useModal } from "@/hooks";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Badges from "@/components/shared/Badges";
import { Formatting } from "@/helpers/formatter";
const { DateTime } = require('luxon');
 
export function ProfileSettings() {
  const { client } = useClient();
  const { openModal } = useModal();
  const { t } = useTranslation();
  const forceUpdate = useForceUpdate();
    const [savedData, setSavedData] = useState({
        avatar: client?.user?.avatar!,
        username: client?.user?.username!,
        global_name: client?.user?.globalName!,
        aboutMe: client?.user?.aboutMe!, 
    });

    const [data, setData] = useState(savedData);

    const saveData = () => {
        client?.user?.edit(data).then(() => setSavedData(data));
        forceUpdate();
  }
  
  
function formatDate(timpstamp: number) {
    const dt = DateTime.fromISO(timpstamp);
    return dt.toFormat('LLL d\'th\', yyyy');
}
    
    return (
      <>
        {JSON.stringify(data) != JSON.stringify(savedData) &&
                <div className="action">
                    <Button className="bg-destructive" onClick={() => setData(savedData)}>Reset</Button>
                    <Button onClick={saveData}>Save</Button>
                </div>
        }
        <h1 className="title">Profile</h1>

        <div className="mt-[20px]">
          <div className="h-fit rounded-t-xl">
          <div
            className="h-[100px] rounded-t-xl"
            style={{
              backgroundColor: `gray`,
            }}
          />
          <div className="realtive px-7 mt-[-30px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="group">
            <img
              draggable={false}
              src={data.avatar == client?.user?.avatar ? Formatting.formatAvatar(client?.user?.id, client?.user?.avatar) : data.avatar}
              width={80}
              height={80}
              className="avatar_modal z-[1000] group-hover:grayscale h-[80px] w-[80px] object-cover cursor-pointer"
              alt="avatar"
              />
              
              <input
                type="file"
                accept="image/png, image/gif, image/jpeg"
                  className="opacity-0 ml-1 bg-white rounded-[50%] absolute w-[70px] h-[70px] mt-[-75px] cursor-pointer"
                  onChange={(event) => {
                    if (event.target.files) {
                      if (event.target.files.length > 0) {
                     let reader = new FileReader();
                        reader.readAsDataURL(event.target.files[0]);
                        reader.onload = (loaded) => {
                           setData({ ...data, avatar: loaded.target?.result?.toString()! })
                        }; 
                      }
                    }
                  }}
                />
          </div>
          </div> 
          <div className="flex justify-end py-4 px-1.5 mt-[-50px]">
            {client?.user?.flags! > 0 ? (
              <div className="p-2 bg-black flex gap-2 rounded-xl">
                <Badges flags={client?.user?.flags!} />
              </div>
            ) : (
              <div className="p-4"></div>
            )}
          </div>
          <div className="w-full px-2 h-fit pb-2">
            <div className="w-full bg-black px-4 py-2 rounded-xl">
              <span className="text-xl font-bold block">
               {client?.user?.globalName}
              </span>
              <span
                className="text-base font-bold block cursor-pointer"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${client?.user?.username}#${client?.user?.discriminator
                      .toString()
                      .padStart(4, "0")}`
                  )
                }
              >
              {client?.user?.username}#{client?.user?.discriminator.toString().padStart(4, "0")}
              </span>
              <span className="text-gray-400">{client?.user?.presence.status_text}</span>
              <div className="w-full h-0.5 bg-gray-500 rounded-full my-2" />
              <span className="text-sm font-bold block mt-1">ABOUT</span>
               {client?.user?.aboutMe ? (
                <span>{client?.user?.aboutMe}</span>
              ) : (
                <span className="text-gray-400">No About Provided</span>
              )} 
              <span className="text-sm font-bold block mt-2">MEMBER SINCE</span>
                <span className="text-gray-400">{formatDate(client?.user?.createdAt!)}</span>
            </div>
          </div>
        </div>
            </div>
    </>
    )
}
