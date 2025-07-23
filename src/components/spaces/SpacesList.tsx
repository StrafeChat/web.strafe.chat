import { Component, createMemo, Show, For, createSignal } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
// import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useMobileNav } from "../../lib/providers/mobile/MobileNavProvider";
import { useNavigationHistory } from "../../lib/providers/navigation/NavigationHistoryProvider";
import { Tooltip } from "../common/Tooltip";
import { FS_URL } from "../../constants";
import { RoomType } from "../../types/roomTypes";
import Plus from "../shared/icons/Plus";
import DefaultGroupPM from "../shared/icons/DefaultGroupPM";
import { CreateSpaceModal } from "../modals/CreateSpaceModal";



const SpacesList: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { relationshipRequests, user, rooms, isMobile, spaces } = useAuth();
  const { setCurrentView } = useMobileNav();
  const { getLastHomeRoute, getLastSpaceRoute } = useNavigationHistory();
  // const cache = useCache();
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [hoveredSpace, setHoveredSpace] = createSignal<string | null>(null);
  const [hoveredHome, setHoveredHome] = createSignal(false);

  // Memoized function to check if a space is currently active
  const isSpaceActive = createMemo(() => {
    const pathname = location.pathname;
    const spaceMatch = pathname.match(/\/spaces\/(\d+)/);
    return spaceMatch ? String(spaceMatch[1]) : null;
  });

  // Memoized function to check if we're on the home page
  const isHomePage = createMemo(() => {
    const path = location.pathname;
    return path === "/" || 
           path === "/home" || 
           path === "/friends" || 
           path === "/notes" || 
           path.startsWith("/rooms");
  });

  // Get user's spaces from auth provider signal
  const userSpaces = createMemo(() => {
    const spaceData = spaces();
    console.log('[SpacesList] Spaces from auth signal:', spaceData);
    return spaceData;
  });



  const unreadCount = createMemo(() => {
    const currentUser = user();
    const allRooms = rooms();
    
    // Don't show unread count if user is in DND mode
    if (currentUser?.presence?.status === "dnd") return 0;
    
    return allRooms.reduce((total, room) => total + (room.unread_count || 0), 0);
  });

  const pendingCount = createMemo(() => {
    const currentUser = user();
    const currentRelationships = relationshipRequests();
    if (!currentUser?.id || !currentRelationships) return 0;

    return currentRelationships.filter(
      (rel) => rel.recipient_id === currentUser.id,
    ).length;
  });

  // Get rooms with unread messages
  const unreadRooms = createMemo(() => {
    const allRooms = rooms();
    const currentUser = user();
    
    // Don't show unread rooms if user is in DND mode
    if (currentUser?.presence?.status === "dnd") return [];
    
    return allRooms.filter(room => (room.unread_count ?? 0) > 0);
  });

  // Helper function to get room avatar
  const getRoomAvatar = (room: any) => {
    // If room has an icon, use it (for group PMs)
    if (room.icon) return `${FS_URL}/icons/${room.id}/${room.icon}`;
    
    // For group PMs without an icon, use our custom SVG icon component
    if (room.type === RoomType.GROUP_PM) {
      return null; // Return null to indicate we'll use the DefaultGroupPM component
    }
    
    // For PMs, use the other user's avatar
    if (room.recipients_data && room.recipients_data.length > 0) {
      const currentUserId = user()?.id;
      // Find the recipient that isn't the current user
      const recipient = room.recipients_data.find((r: any) => r.id !== currentUserId);
      if (recipient) {
        return `${FS_URL}/avatars/${recipient.id}/${recipient.avatar || "default.webp"}`;
      }
      // Fallback to first recipient if we can't find a non-current user
      const firstRecipient = room.recipients_data[0];
      return `${FS_URL}/avatars/${firstRecipient.id}/${firstRecipient.avatar || "default.webp"}`;
    }
    
    // Use userId/default.webp instead of default/favicon.ico
    const currentUserId = user()?.id || "default";
    return `${FS_URL}/avatars/${currentUserId}/default.webp`;
  };

  return (
    <div class="flex flex-col items-center h-full py-3 pb-14 md:pb-3 gap-2 bg-[var(--background)] relative">
      {/* Home button */}
      <Tooltip content={"Home"} position="right">
        <button
            class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all group relative"
            onClick={() => {
              const lastHomeRoute = getLastHomeRoute();
              navigate(lastHomeRoute);
            }}
            onMouseEnter={() => setHoveredHome(true)}
            onMouseLeave={() => setHoveredHome(false)}
          >
          {/* Active indicator */}
          <Show when={isHomePage()}>
            <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-accent rounded-r-full"></div>
          </Show>
          {/* Hover indicator */}
          <Show when={hoveredHome() && !isHomePage()}>
            <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-accent bg-opacity-60 rounded-r-full"></div>
          </Show>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <Show when={unreadCount() > 0 || pendingCount() > 0}>
            <div class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-[20px] h-[20px] rounded-full grid place-items-center border-[2.5px] border-[var(--background)]">
              {unreadCount() + pendingCount()}
            </div>
          </Show>
        </button>
      </Tooltip>

      {/* Unread messages avatars */}
      <Show when={unreadRooms().length > 0}>
        <div class="flex flex-col gap-2 mt-2">
          <For each={unreadRooms().slice(0, 3)}>
            {(room) => (
              <Tooltip content={`Unread messages in ${room.name || 'chat'}`} position="right">
                <button 
                  class="w-10 h-10 rounded-full relative overflow-hidden border-2 border-surface hover:border-accent transition-all"
                  onClick={() => {
                    navigate(`/rooms/${room.id}`);
                    if (isMobile()) {
                      setCurrentView("content");
                    }
                  }}
                >
                  {room.type === RoomType.GROUP_PM && !room.icon ? (
                    <div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center">
                      <DefaultGroupPM />
                    </div>
                  ) : (
                    <img
                      src={getRoomAvatar(room) || undefined}
                      alt="Room avatar"
                      class="w-full h-full object-cover"
                      draggable="false"
                      onError={(e) => {
                        // Replace failed room icon with default group icon for group PMs
                        const target = e.target as HTMLImageElement;
                        const container = target.parentElement;
                        if (container && room.type === RoomType.GROUP_PM) {
                          container.innerHTML = '<div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" /><path d="M8.25 9.75a3 3 0 10-6 0 3 3 0 006 0zm9.5 0a3 3 0 10-6 0 3 3 0 006 0z" fill-opacity="0.5" /></svg></div>';
                        }
                      }}
                    />
                  )}
                  <div class="absolute bottom-0 right-0 bg-red-500 w-[12px] h-[12px] rounded-full border-2 border-[var(--background)]"></div>
                </button>
              </Tooltip>
            )}
          </For>
          <Show when={unreadRooms().length > 3}>
            <Tooltip content={`${unreadRooms().length - 3} more rooms with unread messages`} position="right">
              <div class="w-10 h-10 rounded-full bg-surface text-text-primary flex items-center justify-center text-xs font-medium relative">
                +{unreadRooms().length - 3}
                <div class="absolute bottom-0 right-0 bg-red-500 w-[12px] h-[12px] rounded-full border-2 border-[var(--background)]"></div>
              </div>
            </Tooltip>
          </Show>
        </div>
      </Show>

      {/* Separator */}
      <div class="w-8 h-0.5 rounded-full bg-border" />

      {/* Spaces List */}
      <div class="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0 hide-scrollbar">
        <For each={userSpaces()}>
          {(space) => (
            <Tooltip content={space.name} position="right">
              <button
                class={`w-12 h-12 flex-shrink-0 ${isSpaceActive() === String(space.id) ? "rounded-2xl" : "rounded-full hover:rounded-2xl"} bg-surface hover:bg-accent relative overflow-hidden group transition-all duration-200`}
                onClick={() => {
                  const lastSpaceRoute = getLastSpaceRoute(String(space.id));
                  navigate(lastSpaceRoute);
                  if (isMobile()) {
                    setCurrentView("content");
                  }
                }}
                onMouseEnter={() => setHoveredSpace(String(space.id))}
                onMouseLeave={() => setHoveredSpace(null)}
              >
                {/* Active indicator */}
                <Show when={isSpaceActive() === String(space.id)}>
                  <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-accent rounded-r-full"></div>
                </Show>
                {/* Hover indicator */}
                <Show when={hoveredSpace() === String(space.id) && isSpaceActive() !== String(space.id)}>
                  <div class="absolute -left-3 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-accent bg-opacity-60 rounded-r-full"></div>
                </Show>
                <Show
                  when={space.icon}
                  fallback={
                    <div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center text-lg font-semibold">
                      {space.name_acronym}
                    </div>
                  }
                >
                  <img
                    src={`${FS_URL}/space_icons/${space.id}/${space.icon}`}
                    alt={space.name}
                    class="w-full h-full object-cover"
                    draggable="false"
                    onError={(e) => {
                      // Replace failed space icon with acronym
                      const target = e.target as HTMLImageElement;
                      const container = target.parentElement;
                      if (container) {
                        container.innerHTML = `<div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center text-lg font-semibold">${space.name_acronym}</div>`;
                      }
                    }}
                  />
                </Show>
              </button>
            </Tooltip>
          )}
        </For>
      </div>

      {/* Separator */}
      <div class="w-8 h-0.5 rounded-full bg-border" />

      {/* Bottom buttons container */}
      <div class="flex flex-col gap-2">
        <Tooltip content={"Add a Space"} position="right">
          <button 
            class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus />
          </button>
        </Tooltip>

        <Tooltip content={"Discover"} position="right">
          <button class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Create Space Modal */}
      <CreateSpaceModal
        isOpen={showCreateModal()}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
};

export default SpacesList;
