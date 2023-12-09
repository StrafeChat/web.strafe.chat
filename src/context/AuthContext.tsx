"use client";
import AuthService from "@/services/AuthService";
import LoadingScreen from "@/components/LoadingScreen";
import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";

export interface User {
  id: string;
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
  setUser: Dispatch<SetStateAction<User>>;
  setRelationships: Dispatch<SetStateAction<Relationship[]>>;
}

const AuthContext = createContext<Context>({
  user: {} as unknown as User,
  relationships: [],
  setUser: {} as Dispatch<SetStateAction<User>>,
  setRelationships: {} as Dispatch<SetStateAction<Relationship[]>>,
});

export const AuthProvider = ({ children }: { children: JSX.Element }) => {
  const [user, setUser] = useState<User>({} as unknown as User);
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  return (
    <AuthContext.Provider
      value={{ user, relationships, setUser, setRelationships }}
    >
      <AuthService>{children}</AuthService>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
