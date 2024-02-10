"use client"
import { ElectronTitleBar } from "@/components/shared";
import quotes from "@/assets/loading.json";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useUI } from "@/providers/UIProvider"
import React from "react";

export function LoadingScreen() {

  const { electron } = useUI();
  const [quote, setQuote] = useState("Loading...")
  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)])
  }, [])

  return (
    <div className="flex flex-col w-full h-full">
      {electron && <ElectronTitleBar />}
      <div className="bg-[#262626] flex items-center justify-center flex-col h-[100vh] py-3 px-5 text-center">
        <div className="flex flex-row items-center justify-center">
          <Image
            className="select-none"
            src="/Spinner-1s-200px.svg"
            priority
            width={86}
            height={86}
            alt="loader"
          />
        </div>
        <br></br>
        <div className="text-white" >
          {quote}
        </div>
      </div>
    </div>
  );
}