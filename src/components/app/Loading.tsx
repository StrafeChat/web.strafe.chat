import quotes from "@/assets/loading.json";
import Image from "next/image";
import React from "react";
export default function LoadingScreen() {
  return (

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
      <div className="text-white" suppressHydrationWarning>
        {quotes[Math.floor(Math.random() * quotes.length)]}
      </div>
    </div>
  );
}