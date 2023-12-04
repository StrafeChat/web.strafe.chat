"use client";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: JSX.Element }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (pathname == "/login" || pathname == "/register") return <>{children}</>;
  if (Object.keys(user).length < 1) return <></>;

  return (
    <main className="layout">
      <div className="servers">
        <div className="avatar">
          <Image
            priority
            src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${user.avatar}.png`}
            width={40}
            height={40}
            alt="avatar"
          />
        </div>
      </div>
      <div className="channels"></div>
      <div className="chat">{children}</div>
    </main>
  );
}
