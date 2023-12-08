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
  setTab: Dispatch<SetStateAction<string>>;
}

const RoomContext = createContext<Context>({
  tab: "friends",
  setTab: {} as Dispatch<SetStateAction<string>>,
});

export const RoomProvider = ({ children }: { children: JSX.Element }) => {
  const [tab, setTab] = useState<string>("friends");

  return (
    <RoomContext.Provider
      value={{ tab, setTab }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => useContext(RoomContext);
