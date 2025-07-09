import { Component, createMemo, createSignal, Show, For } from "solid-js";
import DefaultGroupPM from "../shared/icons/DefaultGroupPM";
import { useParams } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
// import { useTransContext } from "@mbarzda/solid-i18next";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";
import { BASE_URL, FS_URL } from "../../constants";
import { Avatar } from "../common/Avatar";
import { RoomType } from "../../types/roomTypes";
import ChatArea from "./ChatArea";
import { Tooltip } from "../common/Tooltip";
import UserPopupMenu from "../common/UserPopupMenu";
import { GroupManagementModal } from "../modals/GroupManagementModal";
import { AddMemberModal } from "../modals/AddMemberModal";

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
      // First check if we have recipients array to find the other user ID
      if (room.type === RoomType.PM && room.recipients && room.recipients.length > 0) {
        const currentUserId = user()?.id;
        // Find the recipient ID that isn't the current user
        const otherRecipientId = room.recipients.find((id) => id !== currentUserId);
        
        if (otherRecipientId) {
          // Try to get user from cache first
          const cachedUser = cache.getUser(otherRecipientId);
          if (cachedUser) {
            return cachedUser.display_name || cachedUser.username;
          }
          
          // If not in cache, look in recipients_data
          const recipientData = room.recipients_data.find((r) => r.id === otherRecipientId);
          if (recipientData) {
            return recipientData.display_name || recipientData.username;
          }
          
          // If we have the ID but no data yet, show loading state
          return "Loading...";
        }
      }
      
      // Fallback to searching recipients_data if recipients array isn't available
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
      
      // If somehow we couldn't find any non-current users, show loading state
      // This prevents showing the current user temporarily
      if (room.type === RoomType.PM) {
        return "Loading...";
      }
      
      // Last resort fallback
      return room.recipients_data[0].display_name || room.recipients_data[0].username;
    }
    
    return "Unknown Chat";
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
            banner: cachedUser.banner,
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
            banner: cachedUser.banner,
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

  // Add state for user popup menu for members
  const [userPopupOpen, setUserPopupOpen] = createSignal(false);
  const [userPopupTrigger, setUserPopupTrigger] = createSignal<HTMLElement | undefined>();
  const [selectedUserId, setSelectedUserId] = createSignal<string | null>(null);

  // Add state for group management modal
  const [showGroupManagement, setShowGroupManagement] = createSignal(false);
  const [showAddMember, setShowAddMember] = createSignal(false);
  const [contextMenuOpen, setContextMenuOpen] = createSignal(false);
  const [contextMenuPosition, setContextMenuPosition] = createSignal({ x: 0, y: 0 });
  const [contextMenuMember, setContextMenuMember] = createSignal<string | null>(null);
  const [removingMember, setRemovingMember] = createSignal(false);

  // Handle member context menu
  const handleMemberRightClick = (event: MouseEvent, memberId: string) => {
    event.preventDefault();
    
    // Context menu dimensions (fixed)
    const menuWidth = 200;
    const menuHeight = 150; // Approximate height for menu items
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate initial position
    let x = event.clientX;
    let y = event.clientY;
    
    // Adjust x position if menu would overflow right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10; // 10px padding from edge
    }
    
    // Adjust y position if menu would overflow bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10; // 10px padding from edge
    }
    
    // Ensure minimum distance from edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    setContextMenuPosition({ x, y });
    setContextMenuMember(memberId);
    setContextMenuOpen(true);
  };

  // Handle removing a member
  const handleRemoveMember = async (memberId: string) => {
    setRemovingMember(true);
    setContextMenuOpen(false);
    
    try {
      const response = await fetch(`${BASE_URL}/rooms/${params.roomId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({ user_id: memberId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove member');
      }

      // Optionally show a success message or refresh the room data
    } catch (err) {
      console.error('Failed to remove member:', err);
      // Optionally show an error message
    } finally {
      setRemovingMember(false);
      setContextMenuMember(null);
    }
  };

  // Handle transferring ownership
  const [transferringOwnership, setTransferringOwnership] = createSignal(false);
  
  const handleTransferOwnership = async (newOwnerId: string) => {
    setTransferringOwnership(true);
    setContextMenuOpen(false);
    
    try {
      const response = await fetch(`${BASE_URL}/rooms/${params.roomId}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({ new_owner_id: newOwnerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to transfer ownership');
      }

      // Optionally show a success message
    } catch (err) {
      console.error('Failed to transfer ownership:', err);
      // Optionally show an error message
    } finally {
       setTransferringOwnership(false);
       setContextMenuMember(null);
     }
   };

  // Close context menu when clicking outside
  const handleClickOutside = () => {
    setContextMenuOpen(false);
    setContextMenuMember(null);
  };


  return (
    <div class="h-full w-full flex flex-col bg-background2">
      {/* Header with consistent styling */}
      <div class="px-4 flex items-center justify-between h-[60px] bg-background2 relative z-10 [box-shadow:0_2px_4px_-2px_rgba(0,0,0,0.2)]">
        <div class="flex items-center gap-2">
          <div class="relative flex-shrink-0 flex items-center">
            <div class="w-8 h-8 rounded-full overflow-hidden">
              {roomType() === RoomType.GROUP_PM ? (
                currentRoom()?.icon ? (
                  <img
                    src={`${FS_URL}/icons/${currentRoom()?.id}/${currentRoom()?.icon}`}
                    alt="Group icon"
                    class="w-full h-full object-cover"
                  />
                ) : (
                  <div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center">
                    <DefaultGroupPM />
                  </div>
                )
              ) : roomType() === RoomType.PM ? (
                <Show
                  when={Boolean(currentRoom()?.recipients_data?.length)}
                  fallback={
                    <Avatar
                      userId="default"
                      avatar="default.webp"
                      alt="Room avatar"
                      size="sm"
                    />
                  }
                >
                  {(() => {
                    const room = currentRoom();
                    const currentUserId = user()?.id;
                    const recipient = room?.recipients_data?.find((r) => r.id !== currentUserId);
                    return (
                      <Avatar
                        userId={recipient?.id || "default"}
                        avatar={recipient?.avatar || "default.webp"}
                        alt="Room avatar"
                        size="sm"
                      />
                    );
                  })()}
                </Show>
              ) : (
                <Avatar
                  userId="default"
                  avatar="default.webp"
                  alt="Room avatar"
                  size="sm"
                />
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
              <Show 
                when={currentRoom()?.topic && currentRoom()?.topic.trim()}
                fallback={
                  <p class="text-xs text-text-secondary">
                    {recipientCount()} Members
                  </p>
                }
              >
                <p class="text-xs text-text-secondary truncate max-w-[200px]">
                  {currentRoom()?.topic}
                </p>
              </Show>
            </Show>
          </div>
        </div>
        
        {/* Group PM controls */}
        <Show when={roomType() === RoomType.GROUP_PM}>
          <div class="flex items-center gap-2">
            {/* Add Member - available to all members */}
            <Tooltip content="Add Member" position="bottom">
              <button 
                onClick={() => setShowAddMember(true)}
                class="p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors text-text-secondary hover:text-text-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </button>
            </Tooltip>
            
            {/* Owner-only controls */}
            <Show when={currentRoom()?.owner_id === user()?.id}>
              <Tooltip content="Group Settings" position="bottom">
                <button 
                  onClick={() => setShowGroupManagement(true)}
                  class="p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors text-text-secondary hover:text-text-primary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </Tooltip>
            </Show>
            
            {/* Member list toggle - available to all members */}
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
          </div>
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
            class={`room-member-list bg-[var(--background1)] overflow-y-auto shadow-lg transition-all pl-.5 duration-300 ${isMobile() ? 'fixed inset-0 z-50' : 'relative h-full w-[250px]'}`}
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
                  <div
                    class={`flex items-center gap-2 p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors cursor-pointer ${
                      userPopupOpen() && selectedUserId() === member.id 
                        ? 'bg-surface bg-opacity-20' 
                        : ''
                    }`}
                    onClick={(e) => {
                      console.log('Clicked member:', member.id, member.username);
                      setSelectedUserId(member.id);
                      setUserPopupTrigger(e.currentTarget as HTMLElement);
                      setUserPopupOpen(true);
                    }}
                    onContextMenu={(e) => handleMemberRightClick(e, member.id)}
                  >
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
                      <div class="flex items-center gap-1">
                        <div class="text-sm font-medium text-text-primary truncate">
                          {member.display_name || member.username}
                        </div>
                        {/* Crown icon for group owner */}
                         <Show when={currentRoom()?.owner_id === member.id}>
                           <Tooltip content="Group Owner" position="top">
                             <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-yellow-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                               <path d="M2 18h20v2H2v-2zm1.15-12L7 8l5-6 5 6 3.85-2L22 18H2l1.15-12z" />
                             </svg>
                           </Tooltip>
                         </Show>
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
              <UserPopupMenu
                isOpen={userPopupOpen()}
                onClose={() => setUserPopupOpen(false)}
                triggerRef={userPopupTrigger()}
                userId={selectedUserId() || ""}
                placement={userPopupTrigger()?.closest('.room-member-list') ? "left" : "right"}
              />
            </div>
          </div>
        </Show>
      </div>
      
      {/* Group Management Modal */}
      <Show when={currentRoom()}>
        <GroupManagementModal
          isOpen={showGroupManagement()}
          onClose={() => setShowGroupManagement(false)}
          room={currentRoom()!}
        />
      </Show>
      
      {/* Add Member Modal */}
      <Show when={currentRoom()}>
        <AddMemberModal
          isOpen={showAddMember()}
          onClose={() => setShowAddMember(false)}
          room={currentRoom()!}
        />
      </Show>
      
      {/* Member Context Menu */}
      <Show when={contextMenuOpen()}>
        <div 
          class="fixed inset-0 z-50"
          onClick={handleClickOutside}
        >
          <div 
            class="absolute bg-background2 border border-surface rounded-md shadow-lg py-1 w-[200px]"
            style={{
              left: `${contextMenuPosition().x}px`,
              top: `${contextMenuPosition().y}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Context menu options */}
            {roomType() === RoomType.GROUP_PM && (
              <>
                {/* Options for group owners when right-clicking other members */}
                {currentRoom()?.owner_id === user()?.id && contextMenuMember() !== user()?.id && (
                  <>
                    <button
                      class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-surface hover:bg-opacity-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => contextMenuMember() && handleTransferOwnership(contextMenuMember()!)}
                      disabled={transferringOwnership()}
                    >
                      {transferringOwnership() ? 'Transferring...' : 'Transfer Ownership'}
                    </button>
                    <button
                      class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-surface hover:bg-opacity-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => contextMenuMember() && handleRemoveMember(contextMenuMember()!)}
                      disabled={removingMember()}
                    >
                      {removingMember() ? 'Removing...' : 'Remove from Group'}
                    </button>
                  </>
                )}
                
                {/* Leave group option when right-clicking yourself */}
                {contextMenuMember() === user()?.id && (
                  <button
                    class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-surface hover:bg-opacity-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => contextMenuMember() && handleRemoveMember(contextMenuMember()!)}
                    disabled={removingMember()}
                  >
                    {removingMember() ? 'Leaving...' : 'Leave Group'}
                  </button>
                )}
                
                {/* Divider */}
                <div class="border-t border-surface my-1"></div>
                
                {/* Copy User ID - always available */}
                <button
                  class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors"
                  onClick={() => {
                    if (contextMenuMember()) {
                      navigator.clipboard.writeText(contextMenuMember()!);
                      setContextMenuOpen(false);
                      setContextMenuMember(null);
                    }
                  }}
                >
                  Copy User ID
                </button>
              </>
            )}
          </div>
        </div>
      </Show>
    </div>
  );
};

export default RoomView;