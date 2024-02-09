import { FaHashtag } from "react-icons/fa6";
import { NavLink } from "../shared/NavLink";
import { useClient } from "@/hooks"

interface Room {
    id: string;
    name: string;
}

export default function SpaceRoomList({ params }: { params: { spaceId: string} }) {
    const { client } = useClient();
    const space = client?.spaces.get(params.spaceId)
    const rooms = space?.rooms;
    console.log(rooms)
    
    return (
        <>
            <div className="header">
                <h1><b>{space?.name}</b></h1>
            </div>

            {/* <ul className="space-rooms">
                {rooms.map((room: Room) => (
                    <NavLink key={room.id} href={`/spaces/${params.spaceId}/rooms/${room.id}`}>
                        <li key={room.id} className="space-room">
                            <FaHashtag />
                            <span>
                                <h2>{room.name}</h2>
                            </span>
                        </li>
                    </NavLink>
                ))}
            </ul> */}
        </>
    )
}