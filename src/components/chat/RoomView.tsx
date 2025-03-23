import { Component, createMemo, createSignal, Show, For } from "solid-js";
import DefaultGroupPM from "../shared/icons/DefaultGroupPM";
import { useParams } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
// import { useTransContext } from "@mbarzda/solid-i18next";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";
import { FS_URL } from "../../constants";
import { Avatar } from "../common/Avatar";
import { RoomType } from "../../types/roomTypes";
import ChatArea from "./ChatArea";
import { Tooltip } from "../common/Tooltip";

const RoomView: Component = () => {
  const params = useParams();
  const { user, rooms, isMobile } = useAuth();
  const cache = useCache();
  // const [t] = useTransContext();

  // Get the current room based on the roomId parameter
  const currentRoom = createMemo(() => {
    const allRooms = rooms();
    if (!allRooms) return null;
    
    return allRooms.find(room => room.id === params.roomId);
  });

  // Function to fetch user data for uncached group PM members
  const fetchMissingUsers = async (userIds: string[]) => {
    if (!userIds.length) return;
    
    // Use the centralized function from AuthProvider
    const { fetchBulkUsers } = useAuth();
    await fetchBulkUsers(userIds);
  };

  // Helper function to get room name for display
  const getRoomName = () => {
    const room = currentRoom();
    if (!room) return "Unknown Chat";
  
    // If room has a name, use it (for group PMs)
    if (room.name) return room.name;
    
    // For PMs, use the other user's display name or username
    if (room.recipients_data && room.recipients_data.length > 0) {
      const currentUserId = user()?.id;
      
      // For group PMs, concatenate all recipient names
      if (room.type === RoomType.GROUP_PM) {
        // Check for missing users in cache and fetch them if needed
        const missingUserIds = room.recipients
          ?.filter((id) => id !== currentUserId && !cache.getUser(id)) || [];
        
        if (missingUserIds.length > 0) {
          // Split into batches of 100 users to respect the API limit
          for (let i = 0; i < missingUserIds.length; i += 100) {
            const batch = missingUserIds.slice(i, i + 100);
            fetchMissingUsers(batch);
          }
        }
        
        // Filter out current user and get display names
        const recipientNames = room.recipients_data
          .filter((r) => r.id !== currentUserId)
          .map((r) => {
            // Use cached data if available for most up-to-date info
            const cachedUser = cache.getUser(r.id);
            if (cachedUser) {
              return cachedUser.display_name || cachedUser.username;
            }
            return r.display_name || r.username;
          });
        
        // Join the first 3 names with commas
        if (recipientNames.length > 3) {
          return `${recipientNames.slice(0, 3).join(', ')} and ${recipientNames.length - 3} more`;
        } else {
          return recipientNames.join(', ');
        }
      }
      
      // For regular PMs
      // First try to find a recipient that isn't the current user
      const otherRecipient = room.recipients_data.find((r) => r.id !== currentUserId);
      
      if (otherRecipient) {
        // Use cached data if available for most up-to-date info
        const cachedUser = cache.getUser(otherRecipient.id);
        if (cachedUser) {
          return cachedUser.display_name || cachedUser.username;
        }
        return otherRecipient.display_name || otherRecipient.username;
      }
      
      // If somehow we couldn't find any non-current users (shouldn't happen), use first recipient
      return room.recipients_data[0].display_name || room.recipients_data[0].username;
    }
    
    return "Unknown Chat";
  };

  // Helper function to get room avatar
  const getRoomAvatar = () => {
    const room = currentRoom();
    if (!room) return `${FS_URL}/avatars/default/default.webp`;

    // If room has an icon, use it (for group PMs)
    if (room.icon) return `${FS_URL}/icons/${room.id}/${room.icon}`;
    
    // For group PMs without an icon, use our custom SVG icon component
    if (room.type === RoomType.GROUP_PM) {
      return null; // Return null to indicate we'll use the DefaultGroupPM component
    }
    
    // For PMs, use the other user's avatar
    if (room.type === RoomType.PM && room.recipients_data && room.recipients_data.length > 0) {
      const currentUserId = user()?.id;
      // Find the recipient that isn't the current user
      const recipient = room.recipients_data.find((r) => r.id !== currentUserId);
      if (recipient) {
        return `${FS_URL}/avatars/${recipient.id}/${recipient.avatar || "default.webp"}`;
      }
      // Fallback to first recipient if we can't find a non-current user
      const firstRecipient = room.recipients_data[0];
      return `${FS_URL}/avatars/${firstRecipient.id}/${firstRecipient.avatar || "default.webp"}`;
    }
    
    const currentUserId = user()?.id || "default";
    return `${FS_URL}/avatars/${currentUserId}/default.webp`;
  };

  // Helper function to get room status (for PMs)
  const getRoomStatus = () => {
    const room = currentRoom();
    if (!room) return "offline" as UserStatus;

    if (room.type === RoomType.PM && room.recipients && room.recipients.length > 0) {
      const currentUserId = user()?.id;
      
      // Find the recipient that isn't the current user
      const recipientId = room.recipients.find((id) => id !== currentUserId);
      if (!recipientId) return "offline" as UserStatus;
      
      const cachedUser = cache.getUser(recipientId);
      
      // Prioritize cached user data for more accurate status
      if (cachedUser?.presence?.status) {
        return cachedUser.presence.status as UserStatus;
      } else if (room.recipients_data && room.recipients_data.length > 0) {
        // Find the recipient data that matches our recipient ID
        const recipient = room.recipients_data.find((r) => r.id === recipientId);
        if (recipient) {
          return (recipient.presence?.status || "offline") as UserStatus;
        }
      }
    }
    return "offline" as UserStatus;
  };

  // Get the room type
  const roomType = createMemo(() => {
    const room = currentRoom();
    return room?.type;
  });

  // Get the number of recipients for group PMs
 const recipientCount = createMemo(() => {
    const room = currentRoom();
    if (!room || !room.recipients) return 0;
    return room.recipients.length;
  });

  // Get members list for the sidebar
  const roomMembers = createMemo(() => {
    const room = currentRoom();
    if (!room) return [];
    
    const currentUserId = user()?.id;
    const allMembers = [];
    
    // Make sure we're getting all recipients from the room data
    if (room.recipients_data && room.recipients_data.length > 0) {
      // Include all members INCLUDING the current user
      for (const member of room.recipients_data) {
        // Use cached data if available for real-time updates
        const cachedUser = cache.getUser(member.id);
        if (cachedUser) {
          allMembers.push({
            id: cachedUser.id,
            username: cachedUser.username,
            discriminator: cachedUser.discriminator,
            display_name: cachedUser.display_name,
            avatar: cachedUser.avatar,
            presence: cachedUser.presence
          });
        } else {
          allMembers.push(member);
        }
      }
      
      // Add current user if not already in the list
      const currentUser = user();
      if (currentUser && !allMembers.some(member => member.id === currentUser.id)) {
        allMembers.push(currentUser);
      }
      
      return allMembers;
    } else if (room.recipients) {
      // Check for missing users in cache and fetch them if needed
      const missingUserIds = room.recipients
        .filter(id => id !== currentUserId && !cache.getUser(id));
      
      if (missingUserIds.length > 0) {
        // Split into batches of 100 users to respect the API limit
        for (let i = 0; i < missingUserIds.length; i += 100) {
          const batch = missingUserIds.slice(i, i + 100);
          fetchMissingUsers(batch);
        }
      }
      
      // If we only have recipient IDs but no data, try to get from cache
      for (const recipientId of room.recipients) {
        const cachedUser = cache.getUser(recipientId);
        if (cachedUser) {
          allMembers.push({
            id: cachedUser.id,
            username: cachedUser.username,
            discriminator: cachedUser.discriminator,
            display_name: cachedUser.display_name,
            avatar: cachedUser.avatar,
            presence: cachedUser.presence
          });
        }
      }
      
      // Add current user if not already in the list
      const currentUser = user();
      if (currentUser && !allMembers.some(member => member.id === currentUser.id)) {
        allMembers.push(currentUser);
      }
      
      return allMembers;
    }
    
    return [];
  });

  // State to control the visibility of the members sidebar
  // Default to true for desktop, false for mobile
  const [showMembers, setShowMembers] = createSignal(!isMobile());

  return (
    <div class="h-full w-full flex flex-col bg-background2">
      {/* Header with consistent styling */}
      <div class="px-4 flex items-center justify-between h-[60px] bg-background2 relative z-10 [box-shadow:0_2px_4px_-2px_rgba(0,0,0,0.2)]">
        <div class="flex items-center gap-2">
          <div class="relative flex-shrink-0 flex items-center">
            <div class="w-8 h-8 rounded-full overflow-hidden">
              {roomType() === RoomType.GROUP_PM && !currentRoom()?.icon ? (
                <div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center">
                  <DefaultGroupPM />
                </div>
              ) : (
                <Show
                  when={getRoomAvatar()}
                  fallback={
                    <Avatar
                      userId="default"
                      avatar="default.webp"
                      alt="Room avatar"
                    />
                  }
                >
                  <img
                    src={getRoomAvatar()!}
                    alt="Room avatar"
                    class="w-full h-full object-cover"
                    draggable="false"
                    onError={(e) => {
                      // Use the actual user ID instead of "default"
                      const userId = user()?.id || "default";
                      e.currentTarget.src = `${FS_URL}/avatars/${userId}/default.webp`;
                    }}
                  />
                </Show>
              )}
            </div>
            {roomType() === RoomType.PM && (
              <StatusIndicator
                status={getRoomStatus()}
                class="border-background1 absolute bottom-[-2px] right-[-2px]"
              />
            )}
          </div>
          <div class="flex flex-col justify-center">
            <h2 class="text-sm font-semibold text-text-primary">{getRoomName()}</h2>
            <Show when={roomType() === RoomType.GROUP_PM}>
              <p class="text-xs text-text-secondary">
                {recipientCount()} Members
              </p>
            </Show>
          </div>
        </div>
        
        {/* Add members toggle button for group PMs */}
        <Show when={roomType() === RoomType.GROUP_PM}>
     <Tooltip content={showMembers() ? "Hide Member List" : "Show Member List"} position="bottom">
          <button 
            onClick={() => setShowMembers(!showMembers())}
            class="p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors text-text-secondary hover:text-text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        </Tooltip>
        </Show>
      </div>
      
      {/* Main content area with sidebar */}
      <div class="flex-1 overflow-hidden flex">
        {/* Chat area - always visible but resizes based on sidebar */}
        <div 
          class={`${(roomType() === RoomType.GROUP_PM && showMembers() && !isMobile()) ? 'w-[calc(100%-250px)]' : 'w-full'} h-full transition-all duration-300`}
        >
          <ChatArea />
        </div>
        
        {/* Members sidebar - conditionally visible based on showMembers state */}
        <Show when={roomType() === RoomType.GROUP_PM}>
          <div 
            class={`bg-[var(--background1)] overflow-y-auto shadow-lg transition-all pl-.5 duration-300 ${isMobile() ? 'fixed inset-0 z-50' : 'relative h-full w-[250px]'}`}
            style={{ 
              display: (!showMembers()) ? 'none' : 'block'
            }}
          >
            <div class="p-3 flex items-center justify-between sticky top-2 bg-[var(--background1)] z-10">
              <h3 class="text-xs font-bold text-text-secondary uppercase">Members - {currentRoom()?.recipients?.length}</h3>
              <Show when={isMobile()}>
                <button 
                  onClick={() => setShowMembers(false)}
                  class="p-2 rounded-full hover:bg-surface hover:bg-opacity-10 transition-colors text-text-secondary hover:text-text-primary"
                  aria-label="Close members sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </Show>
            </div>
            <div class="p-2">
              <For each={roomMembers()}>
                {(member) => (
                  <div class="flex items-center gap-2 p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors">
                    <div class="relative flex-shrink-0">
                      <div class="w-8 h-8 rounded-full overflow-hidden">
                        <Avatar
                          userId={member.id}
                          avatar={member.avatar}
                          alt={`${member.display_name || member.username}'s avatar`}
                          size="sm"
                        />
                      </div>
                      <StatusIndicator
                        status={(member.presence?.status || "offline") as UserStatus}
                        class="absolute -bottom-0.5 -right-0.5 border-2 border-background1"
                      />
                    </div>
                    <div class="flex-1 min-w-0 overflow-hidden">
                      <div class="text-sm font-medium text-text-primary truncate">
                        {member.display_name || member.username}
                      </div>
                      <div class="text-xs text-text-secondary truncate">
                        {member.presence?.status === "offline" ? "Offline" : 
                          member.presence?.custom_status || 
                          (member.presence?.status?.charAt(0).toUpperCase() + member.presence?.status?.slice(1))}
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default RoomView;