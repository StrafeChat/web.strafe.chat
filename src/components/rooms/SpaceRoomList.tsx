import {
  FaHashtag,
  FaVolumeHigh,
  FaXmark,
  FaCirclePlus,
  FaFolderPlus,
  FaRightFromBracket,
  FaFlag,
  FaChevronRight,
  FaChevronDown,
  FaGear,
  FaPlus,
  FaUserPlus,
} from "react-icons/fa6";
import { NavLink } from "../shared/NavLink";
import { useEffect, useState } from "react";
import { useClient, useModal } from "@/hooks";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@radix-ui/react-context-menu";
import { UserItem } from "../shared/UserItem";

interface SpaceRoomListProps {
  params: { spaceId: string };
}

type SectionState = {
  [key: string]: boolean;
};

export default function SpaceRoomList({ params }: SpaceRoomListProps) {
  const { client } = useClient();
  const { openModal } = useModal();
  const space = client?.spaces.get(params.spaceId);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isSectionExpanded, setIsSectionExpanded] = useState<SectionState>({});
  const [draggedRoom, setDraggedRoom] = useState<string | null>(null);
  const [targetPosition, setTargetPosition] = useState<number | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  useEffect(() => {
    if (!space) return;
    const initialState: SectionState = {};
    space.rooms.forEach((room) => {
      if (room.type === 0) {
        initialState[room.id] = true;
      }
    });
    setIsSectionExpanded(initialState);
  }, [params.spaceId]);

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  useEffect(() => {
    setDropdownVisible(false);
  }, [params.spaceId]);

  const toggleSection = (sectionId: string) => {
    setIsSectionExpanded((prevState) => ({
      ...prevState,
      [sectionId]: !prevState[sectionId],
    }));
  };

  const handleDropdownOptionClick = (optionValue: string) => {
    if (optionValue === "leave_space") {
      setDropdownVisible(false);
      openModal("leave-space", {
        spaceId: space?.id,
      });
    } else if (optionValue === "create_room") {
      setDropdownVisible(false);
      openModal("create-room", {
        spaceId: space?.id,
      });
    } else if (optionValue === "create_section") {
      setDropdownVisible(false);
      openModal("create-section", {
        spaceId: space?.id,
      });
    } else if (optionValue === "space_settings") {
      setDropdownVisible(false);
      openModal("space-settings", {
        spaceId: space?.id,
      });
    } else if (optionValue === "invite_people") {
      setDropdownVisible(false);
      openModal("create-invite", {
        spaceId: space?.id,
      });
    }
  };

  const handleDragStart = (roomId: string) => {
    // if (!userPermissions.canDragRooms) return; // Check if user has permission to drag rooms
    setDraggedRoom(roomId);
  };

  const handleDragEnter = (position: number) => {
    // if (!userPermissions.canDragRooms || draggedRoom === null) return;
    setTargetPosition(position);
  };

  const handleDragEnd = () => {
    if (draggedRoom === null || targetPosition === null) return;
    // Make a POST request to update the room position in the backend
    // fetch(`/api/spaces/${space?.id}/rooms/${draggedRoom}/position`, {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({ newPosition: targetPosition }),
    // })
    // .then(response => {
    //     if (response.ok) {
    //         // Update the frontend state accordingly
    //         console.log(`Room ${draggedRoom} moved to position ${targetPosition}`);
    //     } else {
    //         // Handle errors
    //         console.error('Error:', response.statusText);
    //     }
    // })
    // .catch(error => {
    //     console.error('Error:', error);
    // });
    console.log(targetPosition);
    const oldRoom = space?.rooms.get(draggedRoom)!;
    space!.rooms.forEach((room) => {
      if (room.id !== draggedRoom) {
        if (
          oldRoom.position! < targetPosition &&
          room.position > oldRoom.position! &&
          room.position <= targetPosition
        ) {
          (room as any).position -= 1;
        } else if (
          oldRoom.position! > targetPosition &&
          room.position >= targetPosition &&
          room.position < oldRoom.position!
        ) {
          (room as any).position += 1;
        }
      }
    });
    (space!.rooms.get(draggedRoom) as any).position! = targetPosition;
    setDraggedRoom(null);
    setTargetPosition(null);
  };

  return (
    <>
      <div>
        <div
          className="header"
          onClick={toggleDropdown}
          style={{
            display: "inline-flex",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <h1 className="select-none">
            <b>{space?.name}</b>
          </h1>
          {dropdownVisible ? (
            <FaXmark className="w-5 h-5 ml-2" />
          ) : (
            <FaChevronDown className="w-4 h-4 ml-2" />
          )}
        </div>
        {dropdownVisible && space && (
          <div className="absolute bg-black rounded mt-2 mx-4 w-[228px] p-1.5 z-50">
            <div
              key="invite_people"
              className={`flex items-center pl-2 p-1.5 hover:bg-background hover:text-white rounded cursor-pointer text-gray-300`}
              onClick={() => handleDropdownOptionClick("invite_people")}
            >
              <FaUserPlus className="w-4 h-4" />
              <span className="ml-2">Invite People</span>
            </div>
            <hr className="my-2" />
            <div
              key="space_settings"
              className={`flex items-center pl-2 p-1.5 hover:bg-background hover:text-white rounded cursor-pointer text-gray-300`}
              onClick={() => handleDropdownOptionClick("space_settings")}
            >
              <FaGear />
              <span className="ml-2">Space Settings</span>
            </div>
            <div
              key="create_room"
              className={`flex items-center pl-2 p-1.5 hover:bg-background hover:text-white rounded cursor-pointer text-gray-300`}
              onClick={() => handleDropdownOptionClick("create_room")}
            >
              <FaCirclePlus />
              <span className="ml-2">Create Room</span>
            </div>
            <div
              key="create_section"
              className={`flex items-center pl-2 p-1.5 hover:bg-background hover:text-white rounded cursor-pointer text-gray-300`}
              onClick={() => handleDropdownOptionClick("create_section")}
            >
              <FaFolderPlus />
              <span className="ml-2">Create Section</span>
            </div>
            <hr className="my-2" />
            <div
              key="report_space"
              className={`flex items-center pl-2 p-1.5 hover:bg-red-500 hover:text-white rounded cursor-pointer text-red-500`}
              onClick={() => handleDropdownOptionClick("leave_server")}
            >
              <FaFlag />
              <span className="ml-2">Report Space</span>
            </div>
            {space.ownerId !== client?.user?.id && (
              <div
                key="leave_space"
                className={`flex items-center pl-2 p-1.5 hover:bg-red-500 hover:text-white rounded cursor-pointer text-red-500`}
                onClick={() => handleDropdownOptionClick("leave_space")}
              >
                <FaRightFromBracket />
                <span className="ml-2">Leave Space</span>
              </div>
            )}
          </div>
        )}
      </div>
      <ul className="space-rooms">
        <div className="mb-2">
          {space?.rooms
            ?.toArray()
            .filter((room) => [1, 2].includes(room.type) && !room.parentId)
            .sort((a, b) => a.position - b.position)
            .map((room, index) => (
              <NavLink
                key={room.id}
                href={`/spaces/${space.id}/rooms/${room.id}`}
              >
                <li
                  key={room.id}
                  className="space-room relative"
                  draggable={true} // Set draggable attribute based on user permissions
                  onDragStart={() => handleDragStart(room.id)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => setHoveredRoom(room.id)}
                  onMouseLeave={() => setHoveredRoom(null)}
                >
                  <span
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    {room.type === 1 && <FaHashtag />}
                    {room.type === 2 && <FaVolumeHigh />}
                    &nbsp;&nbsp;
                    <h2>{room.name}</h2>
                    {hoveredRoom === room.id && (
                      <>
                        <button
                          className={`absolute right-0 ${
                            space.ownerId == client?.user?.id ? "mr-7" : "mr-2"
                          }`}
                        >
                          <FaUserPlus
                            size={16}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openModal("create-invite", {
                                spaceId: space?.id,
                                roomId: room.id,
                              });
                            }}
                          />
                        </button>
                        {space.ownerId == client?.user?.id && (
                          <button className="absolute right-0 mr-2">
                            <FaGear
                              size={16}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openModal("room-settings", {
                                  spaceId: space?.id,
                                  roomId: room.id,
                                });
                              }}
                            />
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </li>
              </NavLink>
            ))}
        </div>
        {space?.rooms
          ?.toArray()
          .filter((room: { type: number }) => room.type === 0)
          .sort(
            (a: { position: number }, b: { position: number }) =>
              a.position - b.position
          )
          .map((section) => (
            <div key={section.id} className="mb-2 relative">
              <ContextMenu>
                <ContextMenuTrigger>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full"
                  >
                    {isSectionExpanded[section.id] ? (
                      <span className="inline-flex items-center w-full pb-1">
                        <FaChevronDown className="w-2.5 h-2.5" />
                        &nbsp;
                        {section.name}
                        {space.ownerId == client?.user?.id && (
                          <>
                            <button className="absolute right-0 mr-2">
                              <FaPlus
                                size={13}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal("create-room", {
                                    spaceId: space?.id,
                                    parentId: section.id,
                                  });
                                }}
                              />
                            </button>
                            <button className="absolute !font-bold right-0 mr-7">
                              <FaGear
                                size={13}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal("section-settings", {
                                    spaceId: space?.id,
                                    sectionId: section.id,
                                  });
                                }}
                              />
                            </button>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center w-full pb-1">
                        <FaChevronRight className="w-2.5 h-2.5" />
                        &nbsp;
                        {section.name}
                        {space.ownerId == client?.user?.id && (
                          <>
                            <button className="absolute right-0 mr-2">
                              <FaPlus
                                size={13}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal("create-room", {
                                    spaceId: space?.id,
                                    parentId: section.id,
                                  });
                                }}
                              />
                            </button>
                            <button className="absolute !font-bold right-0 mr-7">
                              <FaGear
                                size={13}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal("section-settings", {
                                    spaceId: space?.id,
                                    sectionId: section.id,
                                  });
                                }}
                              />
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <p>g</p>
                </ContextMenuContent>
              </ContextMenu>
              {isSectionExpanded[section.id] &&
                space?.rooms
                  ?.toArray()
                  .filter(
                    (room) =>
                      [1, 2].includes(room.type) && room.parentId == section.id
                  )
                  .sort((a, b) => a.position - b.position)
                  .map((room, index) => (
                    <div>
                      <NavLink
                        key={room.id}
                        href={`/spaces/${space.id}/rooms/${room.id}`}
                      >
                        <ContextMenu>
                          <ContextMenuTrigger>
                            <li
                              key={room.id}
                              className="space-room relative"
                              draggable={true} // Set draggable attribute based on user permissions
                              onDragStart={() => handleDragStart(room.id)}
                              onDragEnter={() => handleDragEnter(index)}
                              onDragEnd={handleDragEnd}
                              onMouseEnter={() => setHoveredRoom(room.id)}
                              onMouseLeave={() => setHoveredRoom(null)}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                {room.type === 1 && <FaHashtag />}
                                {room.type === 2 && <FaVolumeHigh />}
                                &nbsp;&nbsp;
                                <h2>{room.name}</h2>
                                {space.ownerId == client?.user?.id &&
                                  hoveredRoom === room.id && (
                                    <>
                                      <button className="absolute right-0 mr-7 z-50">
                                        <FaUserPlus
                                          size={16}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            openModal("create-invite", {
                                              spaceId: space?.id,
                                              roomId: room.id,
                                            });
                                          }}
                                        />
                                      </button>
                                      <button className="absolute right-0 mr-2 z-50">
                                        <FaGear
                                          size={16}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            openModal("room-settings", {
                                              spaceId: space?.id,
                                              roomId: room.id,
                                            });
                                          }}
                                        />
                                      </button>
                                    </>
                                  )}
                              </span>
                            </li>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <p>g</p>
                          </ContextMenuContent>
                        </ContextMenu>
                      </NavLink>
                      <ul>
                        <>
                          {(room.type === 2) ?
                              // TODO: remove hardcoded dummy user
                            (room.participants || [] || [space.members.get("113727418811810816")!]).map(member =>
                              (
                                <UserItem
                                  user={member.user}
                                />
                              )
                            )
                            : ([])
                          }
                          </>
                        </ul>
                      </div>
                  ))}
            </div>
          ))}
      </ul>
    </>
  );
}