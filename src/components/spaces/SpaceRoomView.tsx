import { Component, createMemo, createSignal, Show, createEffect } from "solid-js";
import { useParams } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
// import { useCache } from "../../lib/providers/cache/CacheProvider";
import RoomsList from "./rooms/RoomsList";
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
    
    console.log("[SpaceRoomView] params.spaceId:", params.spaceId, "type:", typeof params.spaceId);
    console.log("[SpaceRoomView] allSpaces:", allSpaces);
    
    // Convert both to strings for comparison to handle large numbers
    const found = allSpaces.find(space => String(space.id) === String(params.spaceId));
    console.log("[SpaceRoomView] found space:", found);
    
    return found;
  });

  // Get the current room based on the roomId parameter
  const currentRoom = createMemo(() => {
    const allRooms = rooms();
    if (!allRooms) return null;
    
    return allRooms.find(room => room.id === params.roomId);
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
    <div class="h-full w-full flex bg-background2">
      {/* Rooms list */}
      <div class="w-[260px] bg-background1 flex flex-col">
          {(() => {
            const spaceId = currentSpace()?.id ? String(currentSpace()?.id) : undefined;
            console.log("[SpaceRoomView] Passing spaceId to RoomsList:", spaceId, "type:", typeof spaceId);
            return <RoomsList spaceId={spaceId} currentSpace={currentSpace()} />;
          })()}
      </div>
      
      {/* Main content area */}
      <div class="flex-1 flex flex-col">
          {/* Header */}
          <div class="p-2 flex flex-col border-b border-surface border-opacity-20 flex-shrink-0 bg-background2">
            <div class="flex items-center justify-between px-3 py-1">
              <div class="flex items-center gap-2">
                <Show when={currentRoom()?.type === RoomType.TEXT_ROOM} fallback={
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                }>
                  <span class="text-lg text-text-primary">#</span>
                </Show>
                <h2 class="text-lg font-bold text-text-primary truncate">
                  {getRoomName()}
                </h2>
              </div>
              
              {/* Members toggle button */}
              <div class="flex items-center gap-2">
                <button
                  onClick={() => setShowMembers(!showMembers())}
                  class="p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors text-text-secondary hover:text-text-primary"
                  aria-label="Toggle members sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          <div class="flex-1 overflow-hidden flex">
            {/* Chat area */}
            <div 
               class={`${showMembers() && !isMobile() ? 'w-[calc(100%-250px)]' : 'w-full'} h-full transition-all duration-300`}
             >
               <Show when={currentRoom()} fallback={
                 <div class="h-full flex items-center justify-center text-text-secondary">
                   <div class="text-center">
                     <h3 class="text-lg font-medium mb-2">Room not found</h3>
                     <p>The room you're looking for doesn't exist or you don't have access to it.</p>
                   </div>
                 </div>
               }>
                 <ChatArea />
               </Show>
             </div>
             
             {/* Members sidebar - conditionally visible */}
             <SpaceMembersList
                spaceId={currentSpace()?.id}
                currentSpace={currentSpace()}
                isMobile={isMobile()}
                showMembers={showMembers()}
                onToggleMembers={() => setShowMembers(!showMembers())}
              />
          </div>
        </div>
      

    </div>
  );
};