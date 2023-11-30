import { usePathname } from "next/navigation";
import { createContext, useEffect } from "react";

export interface User {}

const AuthContext = createContext<User>({});

export const AuthProvider = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname == "/register" || pathname == "/login") return;
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS!);
  }, [pathname]);

  return <div></div>;
};
