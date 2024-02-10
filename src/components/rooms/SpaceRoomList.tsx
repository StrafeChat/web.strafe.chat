import { FaHashtag, FaVolumeHigh, FaChevronRight, FaChevronDown } from "react-icons/fa6";
import { NavLink } from "../shared/NavLink";
import { useEffect, useState } from "react";
import { useClient } from "@/hooks"

interface Room {
    id: string;
    name: string;
    type: number;
    parent_id: string;
}

type SectionState = {
    [key: string]: boolean;
};

export default function SpaceRoomList({ params }: { params: { spaceId: string} }) {
    const { client } = useClient();
    const space = client?.spaces.get(params.spaceId)
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [isSectionExpanded, setIsSectionExpanded] = useState<SectionState>({});

    useEffect(() => {
        if (!space) return;
        const initialState: SectionState = {};
        space.rooms.forEach(room => {
            if (room.type === 0) {
                initialState[room.id] = true;
            }
        });
        setIsSectionExpanded(initialState);
    }, [params.spaceId]);

    const toggleDropdown = () => {
        setDropdownVisible(!dropdownVisible);
    };

    const toggleSection = (sectionId: string) => {
        setIsSectionExpanded(prevState => ({ ...prevState, [sectionId]: !prevState[sectionId] }));
    };

    return (
        <>
              <div className="header" style={{ display: 'inline-flex', alignItems: 'center' }}>
                 <h1><b>{space?.name}</b></h1>
                 <button onClick={toggleDropdown} className="right-0">
                      <FaChevronDown className="w-4 h-4" />
                 </button>
              </div>

            {  
                <ul className="space-rooms">
                {
                  space?.rooms
                  ?.filter(room => room.type ===  0)
                  .sort((a, b) => a.position - b.position)
                  .map((section: Room) => (
                      <div key={section.id} className="mb-2">
                          <button onClick={() => toggleSection(section.id)}>
                            {
                               isSectionExpanded[section.id] ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '3px' }}>
                                      <FaChevronDown className="w-2.5 h-2.5" />&nbsp;{section.name}
                                    </span>
                                ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                      <FaChevronRight className="w-2.5 h-2.5"/>&nbsp;{section.name}
                                    </span>
                                )
                            }
                          </button>
                        {
                          isSectionExpanded[section.id] &&
                            space?.rooms
                            ?.filter(room => [1,  2].includes(room.type) && room.parent_id == section.id)
                            .sort((a, b) => a.position - b.position)
                            .map((room: Room) => (
                                <NavLink key={room.id} href={`/spaces/${space.id}/rooms/${room.id}`}>
                                    <li key={room.id} className="space-room">
                                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                        {room.type ===  1 && <FaHashtag />}
                                        {room.type ===  2 && <FaVolumeHigh />}
                                        &nbsp;&nbsp;
                                        <h2>{room.name}</h2>
                                        </span>
                                    </li>
                                </NavLink>
                            ))
                          }
                      </div>
                   ))
                }
             </ul>  
            }
        </>
    )
}