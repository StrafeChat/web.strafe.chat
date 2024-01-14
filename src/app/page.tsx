"use client";
import { useClient } from "@/controllers/client/ClientController";
import { useUI } from "@/providers/UIProvider";
import {
  faClock,
  faCompass,
  faGear,
  faNewspaper,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { FaArrowLeft, FaArrowRight, FaHouseChimney } from 'react-icons/fa6';

export default function Home() {

  const { hideRoomList, setHideRoomList } = useUI();
  const [greeting, setGreeting] = useState("");
  const { client } = useClient();

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
     <>
      <div className="header">
        <span className="flex items-center gap-[3px]">
          {hideRoomList ? (
            <>
              <FaHouseChimney onClick={() => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaHouseChimney onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>Home</b></span>
      </div>
      <div className="home overflow-auto">
           <div className="w-full container flex flex-col items-center justify-center h-full py-[100px] text-white">
             <h1 className={`text-5xl font-bold text-[#323C31]-primaryText`}>
               {greeting}, {client?.user?.global_name || client?.user?.username}.
             </h1>
             <p className={`font-md text-xl text-white -secondaryText`}>
               Welcome to Strafe, let&apos;s get started.
             </p>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 my-4">
             <div
      className={`bg-[#141414] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
      // onClick={() => setShowCreateSpace(true)}
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
    <div
      className={`bg-[#141414] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
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
    <div
            className={`bg-[#141414] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
            // onClick={() => setShowSettings(true)}
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
            className={`bg-[#141414] rounded-[0.5rem] p-4 flex items-center cursor-pointer`}
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
              <hr className="w-full my-4 opacity-15" />
             <div className="latest-updates mt-6 w-full px-6"> 
              <h1 className="text-2xl font-bold text-[#323C31]-primaryText"><FontAwesomeIcon icon={faClock}/> Latest Updates</h1>
              {/* <hr className="w-full my-2 opacity-15" /> */}
              <ul className="updates gap-4 mt-4">
                <li className="update my-2 bg-[#141414] rounded-[0.5rem] p-2.5 items-center cursor-pointer">
                  <h3 className="text-xl font-bold text-[#323C31]-primaryText">Authentication</h3>
                  <p className="text-md font-medium text-white -secondaryText">You can now register a Strafe account and login to our web application!</p>
                </li>
                <li className="update my-2 bg-[#141414] rounded-[0.5rem] p-2.5 items-center cursor-pointer">
                  <h3 className="text-xl font-bold text-[#323C31]-primaryText">New Features</h3>
                  <p className="text-md font-medium text-white -secondaryText">We have added a new feature that lets you create your own room and invite your friends to join you.</p>
                </li>
               </ul>
              </div>
            </div>
      </div>
    </>
  );
}
