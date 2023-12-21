"use client";
import AuthService from "@/services/AuthService";
import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { RoomProvider } from "./RoomContext";

export interface User {
  id: string;
  about: string | null;
  username: string;
  discriminator: number;
  global_name: string;
  avatar: string;
  bot: boolean;
  system: boolean;
  mfa_enabled: boolean;
  banner: string;
  accent_color: number;
  locale: string;
  verified: boolean;
  email: string;
  flags: number;
  premium_type: number;
  public_flags: number;
  avatar_decoration: string;
  created_at: Date;
  edited_at: Date;
  presence: {
    status: string;
    status_text: string;
    online: boolean;
  };
}

export interface Relationship {
  sender_id: string;
  sender: User;
  receiver_id: string;
  receiver: User;
  created_at: Date;
  status: "pending" | "accepted" | "blocked";
}

interface Context {
  user: User;
  relationships: Relationship[];
  statusText: string;
  setUser: Dispatch<SetStateAction<User>>;
  setRelationships: Dispatch<SetStateAction<Relationship[]>>;
  setStatusText: Dispatch<SetStateAction<string>>;
  ws: MutableRefObject<WebSocket | null> | null;
  connect: (websocket: WebSocket) => void;
  cleanup: (websocket: WebSocket | null) => void;
}

const AuthContext = createContext<Context>({
  user: {} as unknown as User,
  relationships: [],
  statusText: "",
  setUser: {} as Dispatch<SetStateAction<User>>,
  setRelationships: {} as Dispatch<SetStateAction<Relationship[]>>,
  setStatusText: {} as Dispatch<SetStateAction<string>>,
  ws: null,
  connect: () => null,
  cleanup: () => null
});

export const AuthProvider = ({ children }: { children: JSX.Element }) => {
  const [user, setUser] = useState<User>({} as unknown as User);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [statusText, setStatusText] = useState("");
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (user.presence) setStatusText(user.presence.status_text);
  }, [user]);

  const connect = (websocket: WebSocket) => {
    ws.current = websocket;
  };

  const cleanup = (websocket: WebSocket | null) => {
    if (websocket) {
      websocket.removeEventListener("open", () => false);
      websocket.removeEventListener("message", () => false);
      websocket.removeEventListener("error", () => false);
      websocket.removeEventListener("close", () => false);
      websocket.close();
      ws.current = null // Set ws to null after closing the connection
    }
  };


  return (
    <AuthContext.Provider
      value={{ user, relationships, statusText, ws, setUser, setRelationships, setStatusText, connect, cleanup }}
    >
      <RoomProvider>
        <AuthService>{children}</AuthService>
      </RoomProvider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
