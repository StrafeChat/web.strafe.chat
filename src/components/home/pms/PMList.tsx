import { Component, createSignal, createMemo, Show, For } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../lib/providers/cache/CacheProvider";
import UserSettings from "../../settings/UserSettings";
import ClientUserPopup from "../../common/ClientUserPopup";
import { A } from "@solidjs/router";
import { Tooltip } from "../../common/Tooltip";
import { useTransContext } from "@mbarzda/solid-i18next";
import { StatusIndicator, UserStatus } from "../../common/StatusIndicator";
import Home from "../../shared/icons/Home";
import Friends from "../../shared/icons/Friends";
import Notes from "../../shared/icons/Notes";
import PlusSmall from "../../shared/icons/PlusSmall";
import Settings from "../../shared/icons/Settings";
import DefaultGroupPM from "../../shared/icons/DefaultGroupPM";
import { capitalizeStatus } from "../../../lib/utils/status";
import { CreatePMModal } from "../../modals/CreatePMModal";
import { RoomType } from "../../../types/roomTypes";
import { FS_URL } from "../../../constants";

export const PMList: Component = () => {
  const { relationshipRequests, user, rooms } = useAuth();
  const cache = useCache();
  const [t] = useTransContext();
  const [showSettings, setShowSettings] = createSignal(false);
  const [showUserPopup, setShowUserPopup] = createSignal(false);
  const [userProfileTrigger, setUserProfileTrigger] =
    createSignal<HTMLDivElement>();
  const [customStatus, setCustomStatus] = createSignal("");
  const [customEmoji, setCustomEmoji] = createSignal("");
  const [showCreatePM, setShowCreatePM] = createSignal(false);

  const pendingCount = createMemo(() => {
    const currentUser = user();
    const currentRelationships = relationshipRequests();
    if (!currentUser?.id || !currentRelationships) return 0;

    return currentRelationships.filter(
      (rel) => rel.recipient_id === currentUser.id,
    ).length;
  });

  // Filter rooms to only show PMs (type 0) and Group PMs (type 1)
  const directMessages = createMemo(() => {
    const allRooms = rooms();
    if (!allRooms) return [];
    
    // Filter to only include PMs (type 0) and Group PMs (type 1)
    return allRooms.filter(room => room.type === 0 || room.type === 1);
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
      const recipient = room.recipients_data.find((r: { id: string | undefined; }) => r.id !== currentUserId);
      if (recipient) {
        return `${FS_URL}/avatars/${recipient.id}/${recipient.avatar || "favicon.ico"}`;
      }
      // Fallback to first recipient if we can't find a non-current user
      const firstRecipient = room.recipients_data[0];
      return `${FS_URL}/avatars/${firstRecipient.id}/${firstRecipient.avatar || "favicon.ico"}`;
    }
    
    return `${FS_URL}/avatars/default/favicon.ico`;
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

  return (
    <div class="flex flex-col h-full bg-background1 rounded-tl-2xl">
      <div class="p-2 flex flex-col [box-shadow:0_2px_4px_-2px_rgba(0,0,0,0.2)]">
        <h2 class="text-xl px-3 py-2 font-bold text-text-primary select-none">
          {t("pms.title")}
        </h2>
      </div>

      <div class="flex flex-col gap-1 p-2">
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
              {t("pms.comingSoon")}
            </div>
          }
        >
          <div class="flex flex-col gap-1">
            <For each={directMessages()}>
              {(room) => (
                <A
                  href={`/rooms/${room.id}`}
                  class="flex items-center gap-2 p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
                  activeClass="bg-surface bg-opacity-10"
                >
                  <div class="relative flex-shrink-0">
                    <div class="w-8 h-8 rounded-full overflow-hidden">
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
                        />
                      )}
                    </div>
                    {room.type === RoomType.PM && (
                      <StatusIndicator
                        status={getRoomStatus(room)}
                        class="border-background1 absolute bottom-[-2] right-[-2]"
                      />
                    )}
                  </div>
                  <div class="flex-1 min-w-0 overflow-hidden">
                    <div class="text-sm font-medium text-text-primary truncate select-none">
                      {getRoomName(room)}
                    </div>
                    {room.type === RoomType.PM && getRoomStatus(room) !== "offline" ? (
                      <div class="text-xs text-text-secondary truncate select-none">
                        {getRoomCustomStatus(room)}
                      </div>
                    ) : room.type === RoomType.PM && getRoomStatus(room) === "offline" ? (
                      <div class="text-xs text-text-secondary truncate select-none">
                        Offline
                      </div>
                    ) : room.type === RoomType.GROUP_PM && (
                      <div class="text-xs text-text-secondary truncate select-none">
                        {room.recipients ? room.recipients.length : 0} Members
                      </div>
                    )}
                  </div>
                </A>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="border-t border-border mt-auto">
        <div class="flex items-center bg-background1 pl-1.5 pr-2 py-1 w-full">
          <div class="flex-1 min-w-0 flex items-center overflow-hidden">
            <div
              class="group inline-flex items-center gap-2 hover:bg-surface hover:bg-opacity-10 transition-colors hover:cursor-pointer rounded-md pl-1 pr-2 py-1 overflow-hidden"
              onClick={() => setShowUserPopup(true)}
              ref={setUserProfileTrigger}
            >
              <div class="relative flex items-center flex-shrink-0">
                <div class="relative w-8 h-8">
                  <img
                    src={`${FS_URL}/avatars/${user()?.id}/${
                      user()?.avatar || "favicon.ico"
                    }`}
                    alt="User avatar"
                    draggable="false"
                    class="w-full h-full rounded-full object-cover"
                    style={{ "aspect-ratio": "1/1" }}
                  />
                </div>
                <StatusIndicator
                  status={(user()?.presence?.status || "offline") as UserStatus}
                  class="border-background1 group-hover:border-surface group-hover:border-opacity-10 transition-colors"
                />
              </div>
              <div class="min-w-0 overflow-hidden">
                <div class="text-sm font-medium truncate select-none">
                  {user()?.display_name}
                </div>
                <div class="text-xs text-text-secondary truncate select-none">
                  {user()?.presence?.custom_status ||
                    capitalizeStatus(user()?.presence?.status || "offline")}
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0 ml-2">
            {/* Client User Popup */}
            <ClientUserPopup
              isOpen={showUserPopup()}
              onClose={() => setShowUserPopup(false)}
              triggerRef={userProfileTrigger()}
              customStatus={customStatus()}
              setCustomStatus={setCustomStatus}
              customEmoji={customEmoji()}
              setCustomEmoji={setCustomEmoji}
            />
            {/* User Settings Modal */}
            <Tooltip content={t("settings.sections.user")} position="top">
              <button
                class="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-surface hover:bg-opacity-10"
                onClick={() => setShowSettings(true)}
              >
                <Settings />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
      <UserSettings
        isOpen={showSettings()}
        onClose={() => setShowSettings(false)}
      />

      <CreatePMModal
        isOpen={showCreatePM()}
        onClose={() => setShowCreatePM(false)}
      />
    </div>
  );
};
