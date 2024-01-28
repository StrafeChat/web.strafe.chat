"use client";

import { IRoomContext } from "@/types";
import { createContext } from "react";

const RoomContext = createContext<IRoomContext>({
    room: "",
    rooms: [""],
    setRoom: () => { },
    setRooms: () => { },
});


