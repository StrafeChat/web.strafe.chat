"use client";
import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

interface Context {
  tab: string;
  screenContext: string;
  setTab: Dispatch<SetStateAction<string>>;
  setScreenContext: Dispatch<SetStateAction<string>>;
}

const RoomContext = createContext<Context>({
  tab: "friends",
  screenContext: "",
  setTab: {} as Dispatch<SetStateAction<string>>,
  setScreenContext: {} as Dispatch<SetStateAction<string>>,
});

export const RoomProvider = ({ children }: { children: JSX.Element }) => {
  const [tab, setTab] = useState<string>("friends");
  const [screenContext, setScreenContext] = useState<string>("");

  useEffect(() => {
    switch (tab) {
      case "friends":
        setScreenContext("friends_list");
        break;
      case "notes":
        setScreenContext("notes_list");
        break;
      default:
        setScreenContext("not_found");
        break;
    }
  }, [tab]);

  return (
    <RoomContext.Provider
      value={{ tab, screenContext, setTab, setScreenContext }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => useContext(RoomContext);
