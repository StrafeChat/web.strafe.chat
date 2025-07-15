import { Component, createMemo, createSignal } from "solid-js";
import { useParams } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
// import { useCache } from "../../lib/providers/cache/CacheProvider";
import { SpaceHome } from "./SpaceHome";
import RoomsList from "./rooms/RoomsList";
import SpaceMembersList from "./SpaceMembersList";

const SpaceView: Component = () => {
  const params = useParams();
  const { spaces, isMobile } = useAuth();
  // const cache = useCache();

  // Get the current space based on the spaceId parameter
  const currentSpace = createMemo(() => {
    const allSpaces = spaces();
    if (!allSpaces) return null;
    
    console.log("[SpaceView] params.spaceId:", params.spaceId, "type:", typeof params.spaceId);
    console.log("[SpaceView] allSpaces:", allSpaces);
    
    // Convert both to strings for comparison to handle large numbers
    const found = allSpaces.find(space => String(space.id) === String(params.spaceId));
    console.log("[SpaceView] found space:", found);
    
    // If space not found, try to find the first available space and redirect
    if (!found && allSpaces.length > 0) {
      console.log("[SpaceView] Space not found, redirecting to first available space:", allSpaces[0].id);
      // Use setTimeout to avoid navigation during render
      setTimeout(() => {
        window.location.href = `/spaces/${allSpaces[0].id}`;
      }, 0);
      return allSpaces[0]; // Return the first space temporarily
    }
    
    console.log("[SpaceView] found space id:", found?.id, "type:", typeof found?.id);
    
    return found;
  });



  // State to control the visibility of the members sidebar
  const [showMembers, setShowMembers] = createSignal(!isMobile());



  // // Get space rooms (this would need to be implemented in the cache)
  // const spaceRooms = createMemo(() => {
  //   // For now, return empty array - this would need to be implemented
  //   // to fetch rooms that belong to this space
  //   return [];
  // });

  return (
    <div class="h-full w-full flex flex-col bg-background2">
      {/* Main content area with sidebar */}
      <div class="flex-1 overflow-hidden flex">
        {/* Left sidebar - Rooms list */}
        <div class="w-[260px] bg-background1 flex flex-col">
          {(() => {
            const spaceId = currentSpace()?.id ? String(currentSpace()?.id) : undefined;
            console.log("[SpaceView] Passing spaceId to RoomsList:", spaceId, "type:", typeof spaceId);
            return <RoomsList spaceId={spaceId} currentSpace={currentSpace()} />;
          })()}
        </div>
        
        {/* Right section with header and content */}
        <div class="flex-1 flex flex-col">
          {/* Header */}
          <div class="p-2 flex flex-col border-b border-surface border-opacity-20 flex-shrink-0 bg-background2">
            <div class="flex items-center gap-2 px-3 py-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6 text-text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <h2 class="text-xl font-semibold text-text-primary">
                Home
              </h2>
            </div>
          </div>
          
          {/* Content area with main content and members sidebar */}
          <div class="flex-1 overflow-hidden flex">
            {/* Main content area - Space home or room content */}
            <div 
               class={`${showMembers() && !isMobile() ? 'w-[calc(100%-250px)]' : 'w-full'} h-full transition-all duration-300`}
             >
               <SpaceHome space={currentSpace()} />
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
    </div>
  );
};

export default SpaceView;