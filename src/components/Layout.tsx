"use client";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import { usePathname } from "next/navigation";
import SpaceList from "./SpaceList";
import RoomList from "./RoomList";
import { RoomProvider } from "@/context/RoomContext";

export default function Layout({ children }: { children: JSX.Element }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (pathname == "/login" || pathname == "/register") return <>{children}</>;
  if (Object.keys(user).length < 1) return <></>;
  if (!user) return <LoadingScreen />;

  return (
    <main className="layout">
      <SpaceList user={user} />
      <RoomList />
      <div className="chat">{children}</div>
    </main>
  );
}
