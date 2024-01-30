"use client";
import { UI } from "@/types";
import { Dispatch, SetStateAction, createContext, useContext, useState } from "react";

const UIContext = createContext<UI>({
   electron: false,
   hideRoomList: false,
   isMobile: false,
   setElectron: {} as Dispatch<SetStateAction<boolean>>,
   setHideRoomList: {} as Dispatch<SetStateAction<boolean>>,
   setIsMobile: {} as Dispatch<SetStateAction<boolean>>,
});

const UIProvider = ({ children }: { children: JSX.Element }) => {
   const [electron, setElectron] = useState(false);
   const [hideRoomList, setHideRoomList] = useState(false);
   const [isMobile, setIsMobile] = useState(false);

   return (
      <UIContext.Provider value={{ electron, hideRoomList, isMobile, setElectron, setHideRoomList, setIsMobile }}>{children}</UIContext.Provider>
   )
}


export const useUI = () => useContext(UIContext);

export default UIProvider;