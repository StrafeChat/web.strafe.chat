import { Component, createSignal, createMemo, Show, For, onCleanup, createEffect } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../lib/providers/cache/CacheProvider";
import { useMobileNav } from "../../../lib/providers/mobile/MobileNavProvider";
import { A, useNavigate, useLocation } from "@solidjs/router";
import { Tooltip } from "../../common/Tooltip";
import { useTransContext } from "@mbarzda/solid-i18next";
import { StatusIndicator, UserStatus } from "../../common/StatusIndicator";
import Home from "../../shared/icons/Home";
import Friends from "../../shared/icons/Friends";
import Notes from "../../shared/icons/Notes";
import PlusSmall from "../../shared/icons/PlusSmall";
import DefaultGroupPM from "../../shared/icons/DefaultGroupPM";
import { FS_URL } from "../../../constants";
import { capitalizeStatus } from "../../../lib/utils/status";
import { CreatePMModal } from "../../modals/CreatePMModal";
import { RoomType } from "../../../types/roomTypes";
import { Portal } from "solid-js/web";
import { Avatar } from "../../common/Avatar";
import { ClientUserArea } from "../../shared/ClientUserArea";

export const PMList: Component = () => {              
  const { user, rooms, setRooms, relationshipRequests, isMobile } = useAuth();
  const { setCurrentView } = useMobileNav();
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useCache();
  const [t] = useTransContext();
  const [showCreatePM, setShowCreatePM] = createSignal(false);

  // Helper function to check if a room is currently active
  const isRoomActive = (roomId: string) => {
    return location.pathname === `/rooms/${roomId}`;
  };

  const pendingCount = createMemo(() => {
    const currentUser = user();
    const requests = relationshipRequests();
    if (!currentUser?.id) return 0;

    return requests.filter(
      (rel: { recipient_id: string }) => rel.recipient_id === currentUser.id,
    ).length;
  });

  const directMessages = createMemo(() => {
    const allRooms = rooms();
    const currentUser = user();
    if (!allRooms) return [];
    
    const filteredRooms = allRooms.filter(room => room.type === 0 || room.type === 1);
    
    const sortedRooms = [...filteredRooms].sort((a, b) => {
      if (!a.last_message_id && !b.last_message_id) {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (!a.last_message_id) return 1;
      if (!b.last_message_id) return -1;
      
      // Snowflake IDs are time-based, so we can compare them numerically
      // Convert to BigInt for proper numerical comparison of large IDs
      try {
        const aId = BigInt(a.last_message_id);
        const bId = BigInt(b.last_message_id);
        return Number(bId - aId); // Convert back to number for the sort function
      } catch (e) {
        // Fallback to string comparison if BigInt conversion fails
        return b.last_message_id.localeCompare(a.last_message_id);
      }
    });
    
    if (currentUser?.presence?.status === "dnd") {
      return sortedRooms.map(room => ({ ...room, unread_count: 0 }));
    }
    
    return sortedRooms;
  });
  
  createEffect(() => {
    const handleMessageCreate = (event: CustomEvent) => {
      const { roomId } = event.detail;
      if (!roomId) return;
      
      const currentRooms = rooms();
      if (!currentRooms) return;
      
      const roomIndex = currentRooms.findIndex(r => r.id === roomId);
      if (roomIndex === -1) return;
      
      // Get the room that needs to be updated
      const roomToUpdate = currentRooms[roomIndex];
      
      // Update both last_message_id and updated_at to ensure proper sorting
      const updatedRoom = {
        ...roomToUpdate,
        last_message_id: event.detail.message.id,
        updated_at: new Date().toISOString() // Update the timestamp for sorting
      };
      
      // Create a new array without the room that received a message
      const filteredRooms = currentRooms.filter(r => r.id !== roomId);
      
      // Add the updated room at the beginning to ensure it appears at the top
      // This is critical for real-time sorting of rooms with new messages
      const updatedRooms = [updatedRoom, ...filteredRooms];
      
      // Update the rooms signal with the new array
      // This will trigger the directMessages memo to recalculate
      setRooms(updatedRooms);
      
      // Force a re-render by logging (helps with debugging)
      console.log(`[PMList] Room ${roomId} moved to top after new message ${event.detail.message.id}`);
    };
    
    // Add event listener for message creation
    window.addEventListener("messageCreate", handleMessageCreate as EventListener);
    
    // Clean up event listener on component unmount
    onCleanup(() => {
      window.removeEventListener("messageCreate", handleMessageCreate as EventListener);
    });
  });

  // Function to fetch user data for uncached group PM members
  const fetchMissingUsers = async (userIds: string[]) => {
    if (!userIds.length) return;
    
    // Use the centralized function from AuthProvider
    const { fetchBulkUsers } = useAuth();
    await fetchBulkUsers(userIds);
  };

  // Helper function to get room name for display
  const getRoomName = (room: any) => {
    // If room has a name, use it (for group PMs)
    if (room.name) return room.name;
    
    // For PMs, use the other user's display name or username
    if (room.recipients_data && room.recipients_data.length > 0) {
      const currentUserId = user()?.id;
      
      // For group PMs, concatenate all recipient names
      if (room.type === RoomType.GROUP_PM) {
        // Check for missing users in cache and fetch them if needed
        const missingUserIds = room.recipients
          ?.filter((id: string) => id !== currentUserId && !cache.getUser(id)) || [];
        
        if (missingUserIds.length > 0) {
          fetchMissingUsers(missingUserIds);
        }
        
        // Get all recipient names except the current user
        const recipientNames = room.recipients_data
          .filter((r: { id: string | undefined; }) => r.id !== currentUserId)
          .map((r: { id: string; display_name: string; username: string; }) => {
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
      const otherRecipient = room.recipients_data.find((r: { id: string | undefined; }) => r.id !== currentUserId);
      
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

  // Helper function to get last message preview
  const getLastMessagePreview = (room: any) => {
    if (!room.last_message_id) return "";
    
    const message = cache.getMessage(room.id, room.last_message_id);
    if (!message) return "";
    
    // Get the sender's name
    const currentUserId = user()?.id;
    let senderName = "";
    
    if (message.author_id === currentUserId) {
      senderName = "You";
    } else {
      const sender = cache.getUser(message.author_id);
      if (sender) {
        senderName = sender.display_name || sender.username;
      } else {
        senderName = "Unknown";
      }
    }
    
    // Get message content preview
    let content = message.content || "";
    
    // Handle different message types
    if (message.attachments && message.attachments.length > 0) {
      if (content) {
        content = "📎 " + content;
      } else {
        content = "📎 Attachment";
      }
    }
    
    // if (message.embeds && message.embeds.length > 0 && !content) {
    //   content = "🔗 Embed";
    // }
    
    if (!content) {
      content = "Message";
    }
    
    // Truncate content if too long
    if (content.length > 50) {
      content = content.substring(0, 47) + "...";
    }
    
    // For group PMs, show sender name
    if (room.type === RoomType.GROUP_PM) {
      return `${senderName}: ${content}`;
    }
    
    // For direct PMs, only show content if it's from the other user
    // If it's from current user, show "You: content"
    if (message.author_id === currentUserId) {
      return `You: ${content}`;
    }
    
    return content;
  };

  // Helper function to get room status (for PMs)
  const getRoomStatus = (room: any) => {
    // Only show status indicators for direct PMs (type 0), not group PMs (type 1)
    if (room.type === RoomType.PM && room.recipients && room.recipients.length > 0) {
      const currentUserId = user()?.id;
      
      // Find the recipient that isn't the current user
      const recipientId = room.recipients.find((id: string | undefined) => id !== currentUserId);
      if (!recipientId) return "offline" as UserStatus;
      
      const cachedUser = cache.getUser(recipientId);
      
      // Prioritize cached user data for more accurate status
      if (cachedUser?.presence?.status) {
        return cachedUser.presence.status as UserStatus;
      } else if (room.recipients_data && room.recipients_data.length > 0) {
        // Find the recipient data that matches our recipient ID
        const recipient = room.recipients_data.find((r: { id: any; }) => r.id === recipientId);
        if (recipient) {
          return (recipient.presence?.status || "offline") as UserStatus;
        }
      }
    }
    return "offline" as UserStatus;
  };

  // Helper function to get room custom status (for PMs)
  const getRoomCustomStatus = (room: any) => {
    // Only show custom status for direct PMs (type 0), not group PMs (type 1)
    if (room.type === RoomType.PM && room.recipients && room.recipients.length > 0) {
      const currentUserId = user()?.id;
      
      // Find the recipient that isn't the current user
      const recipientId = room.recipients.find((id: string | undefined) => id !== currentUserId);
      if (!recipientId) return "";
      
      const cachedUser = cache.getUser(recipientId);
      const status = getRoomStatus(room);
      
      // Don't show custom status if user is offline
      if (status === "offline") {
        return "";
      }
      
      if (cachedUser?.presence?.custom_status) {
        return cachedUser.presence.custom_status;
      } else if (cachedUser?.presence?.status) {
        return capitalizeStatus(cachedUser.presence.status);
      } else if (room.recipients_data && room.recipients_data.length > 0) {
        // Find the recipient data that matches our recipient ID
        const recipient = room.recipients_data.find((r: { id: any; }) => r.id === recipientId);
        if (recipient?.presence?.custom_status) {
          return recipient.presence.custom_status;
        } else if (recipient?.presence?.status) {
          return capitalizeStatus(recipient.presence.status);
        }
      }
    }
    return "";
  };

  // Helper function to get room avatar
  // Commented out as it's not currently used but may be needed in the future
  /*
  const getRoomAvatar = (room: any) => {
    // If room has an icon, use it (for group PMs)
    if (room.icon) return `${BASE_URL}/icons/${room.id}/${room.icon}`;
    
    // For group PMs without an icon, use our custom SVG icon component
    if (room.type === RoomType.GROUP_PM) {
      return null; // Return null to indicate we'll use the DefaultGroupPM component
    }
    
    // For PMs, use the other user's avatar
    if (room.recipients_data && room.recipients_data.length > 0) {
      const currentUserId = user()?.id;
      // Find the recipient that isn't the current user
      const recipient = room.recipients_data.find((r: { id: string | undefined; }) => r.id !== currentUserId);
      if (recipient) {
        return `${BASE_URL}/avatars/${recipient.id}/${recipient.avatar || "default.webp"}`;
      }
      // Fallback to first recipient if we can't find a non-current user
      const firstRecipient = room.recipients_data[0];
      return `${BASE_URL}/avatars/${firstRecipient.id}/${firstRecipient.avatar || "default.webp"}`;
    }
    
    // Use userId/default.webp instead of default/favicon.ico
    const currentUserId = user()?.id || "default";
    return `${BASE_URL}/avatars/${currentUserId}/default.webp`;
  };
  */

  return (
    <div class="flex flex-col h-full bg-background1 rounded-tl-2xl overflow-hidden">
      <div class="p-2 flex flex-col border-b border-surface border-opacity-20 flex-shrink-0">
        <h2 class="text-xl px-3 py-2 font-bold text-text-primary select-none">
          {t("pms.title")}
        </h2>
      </div>

      <div class="flex flex-col gap-1 p-2 flex-1 overflow-y-auto min-h-0 pb-14 md:pb-0">
        <A
          href="/"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <Home />
          <span class="text-text-primary select-none">
            {t("navigation.home")}
          </span>
        </A>

        <A
          href="/friends"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <Friends />
          <span class="text-text-primary select-none">
            {t("navigation.friends")}
          </span>
          <Show when={pendingCount() > 0}>
            <div class="ml-auto">
              <div class="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full select-none">
                {pendingCount()}
              </div>
            </div>
          </Show>
        </A>

        <A
          href="/notes"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <Notes />
          <span class="text-text-primary select-none">
            {t("navigation.notes")}
          </span>
        </A>

        <div class="mt-6 mb-2 pl-3 pr-2 flex items-center">
          <span class="text-xs font-bold text-text-primary tracking-wide uppercase select-none">
            {t("pms.conversations")}
          </span>
          <div class="ml-auto">
            <Tooltip content={t("pms.createPM")} position="top">
              <button
                onClick={() => setShowCreatePM(true)}
                class="w-6 h-6 rounded-full hover:bg-surface hover:bg-opacity-10 transition-colors grid place-items-center text-text-primary"
              >
                <PlusSmall />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Display rooms/PMs */}
        <Show
          when={directMessages().length > 0}
          fallback={
            <div class="text-text-secondary text-sm px-3 py-2 select-none">
             You don't have any private messages.
            </div>
          }
        >
          <div class="flex flex-col gap-1">
            <For each={directMessages()}>
              {(room) => (
                <div
                  class={`flex items-center gap-2 p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors relative cursor-pointer ${
                    isRoomActive(room.id) ? 'bg-surface bg-opacity-10' : ''
                  }`}
                  onClick={() => {
                    navigate(`/rooms/${room.id}`);
                    if (isMobile()) {
                      setCurrentView("content");
                    }
                  }}
                >
                  <div class="relative flex-shrink-0">
                    <div class="w-8 h-8 rounded-full overflow-hidden">
                      {room.type === RoomType.GROUP_PM && !room.icon ? (
                        <div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center">
                          <DefaultGroupPM />
                        </div>
                      ) : room.type === RoomType.GROUP_PM && room.icon ? (
                        <img
                          src={`${FS_URL}/icons/${room.id}/${room.icon}`}
                          alt="Room icon"
                          class="w-full h-full object-cover"
                          draggable="false"
                          onError={(e) => {
                            // Replace failed room icon with default group icon
                            const target = e.target as HTMLImageElement;
                            const container = target.parentElement;
                            if (container) {
                              container.innerHTML = '<div class="w-full h-full bg-surface bg-opacity-20 text-text-primary flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-full h-full"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" /><path d="M8.25 9.75a3 3 0 10-6 0 3 3 0 006 0zm9.5 0a3 3 0 10-6 0 3 3 0 006 0z" fill-opacity="0.5" /></svg></div>';
                            }
                          }}
                        />
                      ) : (
                        <Avatar
                          userId={room.recipients_data.find((r: { id: string | undefined; }) => r.id !== user()?.id)?.id || room.recipients_data[0]?.id || "default"}
                          avatar={room.recipients_data.find((r: { id: string | undefined; }) => r.id !== user()?.id)?.avatar || room.recipients_data[0]?.avatar}
                          alt="Room avatar"
                          class="w-full h-full"
                        />
                      )}
                    </div>
                    {room.type === RoomType.PM && (
                      <StatusIndicator
                        status={getRoomStatus(room)}
                        class="border-background1 absolute bottom-[-2] right-[-2]"
                      />
                    )}
                    {/* Add unread indicator */}
                    {(room.unread_count ?? 0) > 0 && (
                      <div class="absolute -top-1 -right-1 bg-red-500 w-[14px] h-[14px] rounded-full border-2 border-background1"></div>
                    )}
                  </div>
                  <div class="flex-1 min-w-0 overflow-hidden">
                    <div class="text-sm font-medium text-text-primary truncate select-none">
                      {getRoomName(room)}
                    </div>
                    {/* Get last message preview if available */}
                    {room.last_message_id ? (
                      <div class="text-xs text-text-secondary truncate select-none">
                        {getLastMessagePreview(room)}
                      </div>
                    ) : room.type === RoomType.PM && getRoomStatus(room) !== "offline" ? (
                      <div class="text-xs text-text-secondary truncate select-none">
                        {getRoomCustomStatus(room)}
                      </div>
                    ) : room.type === RoomType.PM && getRoomStatus(room) === "offline" ? (
                      <div class="text-xs text-text-secondary truncate select-none">
                        Offline
                      </div>
                    ) : room.type === RoomType.GROUP_PM && (
                      <div class="text-xs text-text-secondary truncate select-none">
                        {room.topic && room.topic.trim() ? room.topic : `${room.recipients ? room.recipients.length : 0} Members`}
                      </div>
                    )}
                  </div>
                  {/* Show unread count if there are unread messages */}
                  {(room.unread_count ?? 0) > 0 && (
                    <div class="ml-auto">
                      <div class="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full select-none">
                        {room.unread_count ?? 0}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
      
      <ClientUserArea />
      <Portal>

        <CreatePMModal
          isOpen={showCreatePM()}
          onClose={() => setShowCreatePM(false)}
        />
      </Portal>
    </div>
  );
};

export default PMList;
