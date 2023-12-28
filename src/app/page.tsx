"use client";
import { useUI } from "@/providers/UIProvider";
import { FaHouseDamage } from "react-icons/fa";

export default function Home() {

  const { hideRoomList, setHideRoomList } = useUI();

  return (
    <>
      <div className="header">
        <FaHouseDamage onClick={(event: MouseEvent) => setHideRoomList(!hideRoomList)} />
        <span>Home</span>
      </div>
    </>
  )
}
