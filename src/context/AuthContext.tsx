"use client";
import AuthService from "@/services/AuthService";
import { Dispatch, SetStateAction, createContext, useContext, useState } from "react";

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
}

interface Context {
  user: User;
  setUser: Dispatch<SetStateAction<User>>;
}

const AuthContext = createContext<Context>({
  user: {} as unknown as User,
  setUser: {} as Dispatch<SetStateAction<User>>,
});

export const AuthProvider = ({ children }: { children: JSX.Element }) => {
  const [user, setUser] = useState<User>({} as unknown as User);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <AuthService>{children}</AuthService>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);