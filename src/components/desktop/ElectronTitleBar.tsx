import React, { useEffect } from "react";

export default function ElectronTitleBar() {
  useEffect(() => {
    if (window.WindowAPI)
      window.WindowAPI.notificationApi.sendNotification({
        message: "hi",
        url: "http://localhost:3000/rooms/id?message=id",
        title: "BrydenIsNotSmart",
        avatar: "https://cdn.discordapp.com/attachments/1135670060678123560/1189859177393291284/brydenicon.png"
  });
  }, []);

  return (
    <div className="titlebar p-1 h-6">
      <p className="text-gray-500 pl-[12.5px] text-[14px] font-cario opacity-1 font-bold">
        <b>STRAFE</b>
      </p>
      {/* <button onClick={() => {}} className="absolute right-[85px]  text-gray-500 pr-3 top-[-4px] w-[20px] hover:bg-gray-500">
            <FontAwesomeIcon icon={faWindowMinimize} />
        </button>
         <button onClick={() => {(window as any).resizeTo(screen.availWidth, screen.availHeight)}} className="absolute right-[45px] text-gray-500 pr-3 top-[2px] w-[20px] h-[20px] hover:bg-gray-500">
            <FontAwesomeIcon icon={faWindowMaximize} />
        </button>   
        <button onClick={() => {(window as any).close()}} className="absolute text-gray-500 pl-[3px] right-[10px] hover:text-red-700 top-[2px] w-[20px] h-[20px]">
            <FontAwesomeIcon icon={faWindowClose} />
        </button>      */}
    </div>
  );
}
