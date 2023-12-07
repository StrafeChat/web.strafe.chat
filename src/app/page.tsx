"use client";
import { Button } from "@/components/ui/button";
import { useRoom } from "@/context/RoomContext";

export default function Home() {
  const { screenContext } = useRoom();

  return (
    <>
      <div className="header">Test</div>
      {screenContext == "not_found" && (
        <div className="min-w-full h-[calc(100%-3rem)] flex justify-center items-center">
          <h1 className="text-2xl">NOT FOUND!</h1>
        </div>
      )}
    </>
  );
}
