import { FaHouseChimney, FaHashtag } from "react-icons/fa6";
import NavLink from "../nav/NavLink";

interface Room {
  id: string;
  name: string;
}

export default function RoomsNav({ params }: { params: { spaceId: string, rooms: Room[] } }) {
    return (
        <>
            <div className="header">
                <h1><b>{params.spaceId}</b></h1>
            </div>
            <div className="tab-list">
                <NavLink href={`/spaces/${params.spaceId}`}>
                    <FaHouseChimney />
                    <span>Home</span>
                </NavLink>
            </div>

            <div className="seperator" />
            <ul className="space-rooms">
                {params.rooms.map((room: Room) => (
                <NavLink key={room.id} href={`/spaces/${params.spaceId}/rooms/${room.id}`}>
                    <li key={room.id} className="space-room">
                        <FaHashtag/>
                        <span>
                         <h2>{room.name}</h2>
                        </span>
                    </li>
                </NavLink>
                ))}
            </ul>
        </>
    )
}