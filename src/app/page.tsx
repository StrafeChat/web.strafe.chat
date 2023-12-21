"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
   faHouseChimney,
   faPlus,
   faCompass,
   faGear,
   faNewspaper,
   } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const getTimeBasedGreeting = () => {
      const date = new Date();
      const hour = date.getHours();
  
      if (hour >= 5 && hour < 12) {
        setGreeting("Good Morning");
      } else if (hour >= 12 && hour < 18) {
        setGreeting("Good Afternoon");
      } else if (hour >= 18 && hour < 22) {
        setGreeting("Good Evening");
      } else {
        setGreeting("Good Night");
      }
    };
  
    getTimeBasedGreeting();
  }, []);

  return (

    <div className="home">
      <div className="header">
        <h1>
          <FontAwesomeIcon icon={faHouseChimney} />
          &nbsp;&nbsp;<b>Home</b>
        </h1>
      </div>
  <div className="w-full container flex flex-col items-center justify-center min-h-[65vh] lg:pt-[-25px] text-white">
  <h1 className={`text-5xl font-bold text-[#323C31]-primaryText`}>
    {greeting}, {user.global_name || user.username}.
  </h1>
  <p className={`font-md text-xl text-white -secondaryText`}>
    Welcome to Strafe, let&apos;s get started.
  </p>
  <div className="grid grid-cols-2 gap-4 mt-4">   
  <div
      className={`bg-[#737d3c] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
    >
      <div className="flex-shrink-0">
        <FontAwesomeIcon icon={faPlus} className="text-4xl" />
      </div>
      <div className="ml-4">
        <h2 className="text-lg font-semibold">Create a Space</h2>
        <p className="text-gray-300">
          Build and customize your community YOUR way.
        </p>
      </div>
    </div>
    <Link href="/discover">
    <div
      className={`bg-[#737d3c] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
    >
      <div className="flex-shrink-0">
        <FontAwesomeIcon icon={faCompass} className="text-4xl" />
      </div>
      <div className="ml-4">
        <h2 className="text-lg font-semibold">Discover Strafe</h2>
        <p className="text-gray-300">
        Find interests! Discover bots, spaces, and more.
        </p>
      </div>
    </div>
    </Link>
    <div
            className={`bg-[#737d3c] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
          >
            <div className="flex-shrink-0">
            <FontAwesomeIcon icon={faGear} className="text-4xl" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold">Explore Settings</h2>
              <p className="text-gray-300">
              Use Strafe YOUR way, customize your experience.
              </p>
            </div>
          </div>
          <div
            className={`bg-[#737d3c] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
          >
            <div className="flex-shrink-0">
              <FontAwesomeIcon icon={faNewspaper} className="text-4xl" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold">Stay Updated</h2>
              <p className="text-gray-300">
                Join the official Strafe server to stay updated.
              </p>
            </div>
          </div>    
  </div>
 </div>
</div>
  );
}
