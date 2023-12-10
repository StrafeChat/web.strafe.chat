"use client";
import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";
import { User } from "./AuthContext";

export interface Room {
  id: string;
  created_at: Date;
  edited_at: Date;
  icon: string | null;
  name: string | null;
  owner_id: string | null;
  parent_id: string | null;
  position: number | null;
  recipients: User[] | null;
  space_id: string | null;
  topic: string | null;
  total_messages_sent: number | null;
  // last_message_sent: string | null;
  type: number;
}

interface Context {
  tab: string;
  pms: Room[];
  setTab: Dispatch<SetStateAction<string>>;
  setPMs: Dispatch<SetStateAction<Room[]>>;
}

const RoomContext = createContext<Context>({
  tab: "friends",
  pms: [],
  setTab: {} as Dispatch<SetStateAction<string>>,
  setPMs: {} as Dispatch<SetStateAction<Room[]>>,
});

export const RoomProvider = ({ children }: { children: JSX.Element }) => {
  const [tab, setTab] = useState<string>("friends");
  const [pms, setPMs] = useState<Room[]>([]);

  return (
    <RoomContext.Provider value={{ tab, pms, setTab, setPMs }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => useContext(RoomContext);
