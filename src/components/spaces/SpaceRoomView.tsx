import { Component, createMemo, createSignal, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
// import { useCache } from "../../lib/providers/cache/CacheProvider";
import ChatArea from "../chat/ChatArea";
import { RoomType } from "../../types/roomTypes";
import SpaceMembersList from "./SpaceMembersList";


export const SpaceRoomView: Component = () => {
  const params = useParams();
  const { spaces, rooms, isMobile } = useAuth();
  // const cache = useCache();

  // Get the current space based on the spaceId parameter
  const currentSpace = createMemo(() => {
    const allSpaces = spaces();
    if (!allSpaces) return null;

    console.log(
      "[SpaceRoomView] params.spaceId:",
      params.spaceId,
      "type:",
      typeof params.spaceId,
    );
    console.log("[SpaceRoomView] allSpaces:", allSpaces);

    // Convert both to strings for comparison to handle large numbers
    const found = allSpaces.find(
      (space) => String(space.id) === String(params.spaceId),
    );
    console.log("[SpaceRoomView] found space:", found);

    return found;
  });

  // Get the current room based on the roomId parameter
  const currentRoom = createMemo(() => {
    const allRooms = rooms();
    if (!allRooms) return null;

    return allRooms.find((room) => room.id === params.roomId);
  });

  // Helper function to get room name for display
  const getRoomName = () => {
    const room = currentRoom();
    if (!room) return "Unknown Room";

    return room.name || "Unknown Room";
  };



  // State to control the visibility of the members sidebar
  const [showMembers, setShowMembers] = createSignal(!isMobile());

  // Auto-focus is now handled directly in ChatArea component

  return (
    <div class="h-full w-full flex bg-background2 overflow-hidden">
      {/* Main content area - flexible, can shrink */}
      <div class="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div class="p-2 flex flex-col border-b border-surface border-opacity-20 flex-shrink-0 bg-background2 overflow-hidden">
          <div class="flex items-center justify-between px-3 py-1 min-w-0">
              <div class="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <Show
                when={currentRoom()?.type === RoomType.TEXT_ROOM}
                fallback={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5 text-text-primary flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                }
              >
                {" "}
                <span class="text-lg text-text-primary flex-shrink-0">#</span>
              </Show>
              <h2 class="text-lg font-bold text-text-primary truncate min-w-0">
                {getRoomName()}
              </h2>

            </div>

            {/* Members toggle button */}
              <div class="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowMembers(!showMembers())}
                  class="p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors text-text-secondary hover:text-text-primary flex-shrink-0"
                  aria-label="Toggle members sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>
              </div>
          </div>
        </div>

        {/* Content area with chat and members sidebar */}
        <div class="flex-1 overflow-hidden flex min-h-0">
          {/* Chat area - flexible, can shrink */}
          <div class="flex-1 h-full min-w-0 transition-all duration-300">
            <Show
              when={currentRoom()}
              fallback={
                <div class="h-full flex items-center justify-center text-text-secondary">
                  <div class="text-center">
                    <h3 class="text-lg font-medium mb-2">Room not found</h3>
                    <p>
                      The room you're looking for doesn't exist or you don't
                      have access to it.
                    </p>
                  </div>
                </div>
              }
            >
              <ChatArea />
            </Show>
          </div>

          {/* Members sidebar - fixed width when visible, no shrink */}
          <Show when={showMembers() && !isMobile()}>
            <div class="w-[250px] flex-shrink-0">
              <SpaceMembersList
                spaceId={currentSpace()?.id}
                currentSpace={currentSpace()}
                isMobile={isMobile()}
                showMembers={showMembers()}
                onToggleMembers={() => setShowMembers(!showMembers())}
              />
            </div>
          </Show>

          {/* Mobile members list */}
          <Show when={isMobile()}>
            <SpaceMembersList
              spaceId={currentSpace()?.id}
              currentSpace={currentSpace()}
              isMobile={isMobile()}
              showMembers={showMembers()}
              onToggleMembers={() => setShowMembers(!showMembers())}
            />
          </Show>
        </div>
      </div>
    </div>
  );
};