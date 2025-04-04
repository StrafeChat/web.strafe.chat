import { Component, For, Show, createMemo, createSignal } from "solid-js";
import { useAuth, API_ENDPOINTS } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { Tooltip } from "../../../common/Tooltip";
import { FriendSearch } from "../FriendSearch";
import { FS_URL } from "../../../../constants";
import { StatusIndicator, UserStatus } from "../../../common/StatusIndicator";
import { FriendMenu } from "../FriendMenu";
import { useNavigate } from "@solidjs/router";
import { RoomWithRecipients } from "../../../../types/rooms";

export const OnlineTab: Component = () => {
  const { user, relationships, rooms, setRooms } = useAuth();
  const cache = useCache();
  const [t] = useTransContext();
  const [searchQuery, setSearchQuery] = createSignal("");
  const navigate = useNavigate();
  const [isCreatingPM, setIsCreatingPM] = createSignal(false);

  const onlineFriends = createMemo(() => {
    const currentUser = user();
    const friendIds = relationships();

    if (!currentUser?.id || !friendIds?.length) return [] as const;

    const users = cache.users();
    return friendIds
      .map((id) => users[id])
      .filter(Boolean)
      .map((friend) => ({
        id: friend.id,
        username: friend.username,
        display_name: friend.display_name || friend.username,
        avatar: friend.avatar,
        banner: friend.banner,
        status: friend.presence?.status || "offline",
        custom_status: friend.presence?.custom_status || "",
      }))
      .filter((friend) => friend.status !== "offline");
  });

  const filteredFriends = createMemo(() => {
    const query = searchQuery().toLowerCase();
    return onlineFriends().filter(
      (friend) =>
        friend.username.toLowerCase().includes(query) ||
        friend.display_name.toLowerCase().includes(query),
    );
  });

  // Function to handle message button click
  const handleMessageClick = async (friendId: string) => {
    if (isCreatingPM()) return;
    
    try {
      setIsCreatingPM(true);
      console.log("[OnlineTab:handleMessageClick] Attempting to message friend:", friendId);
      
      // First check if a PM already exists with this friend in the cache
      const allRooms = rooms();
      if (allRooms) {
        // Look for a direct PM (type 0) with this friend
        // More thorough check that handles different recipient array configurations
        const existingPM = allRooms.find(room => {
          // Must be a PM type
          if (room.type !== 0) return false;
          
          // Must have recipients array
          if (!room.recipients) return false;
          
          // For PMs, we're looking for a room where the friend is the only other recipient
          // This handles both cases: when recipients has only the friend, or when it has both users
          return room.recipients.includes(friendId) && 
                 (room.recipients.length === 1 || 
                  (room.recipients.length === 2 && room.recipients.some(id => id !== friendId)));
        });
        
        if (existingPM) {
          console.log("[OnlineTab:handleMessageClick] Found existing PM in cache:", existingPM.id);
          navigate(`/rooms/${existingPM.id}`);
          return;
        }
      }
      
      // No existing PM found in cache, try to create a new one
      console.log("[OnlineTab:handleMessageClick] Creating new PM with friend:", friendId);
      
      const response = await fetch(API_ENDPOINTS.CREATE_ROOM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({
          recipients: [friendId],
          is_group: false,
        }),
      });
      
      const responseData = await response.json();
      
      if (response.status === 409) {
        // Room already exists but wasn't in our cache
        console.log("[OnlineTab:handleMessageClick] Room already exists (409):", responseData);
        
        if (responseData.room && responseData.room.id) {
          // Navigate to the existing room
          navigate(`/rooms/${responseData.room.id}`);
          
          // Add the room to our cache
          setRooms((prev: RoomWithRecipients[]) => {
            // Check if room is already in the cache to avoid duplicates
            if (prev.some(r => r.id === responseData.room.id)) {
              return prev;
            }
            return [...prev, responseData.room] as RoomWithRecipients[];
          });
          return;
        } else if (responseData.id) {
          // Some API responses might include the ID directly
          navigate(`/rooms/${responseData.id}`);
          return;
        } else {
          // If we can't extract a room ID, navigate to the rooms page
          console.error("[OnlineTab:handleMessageClick] Couldn't extract room ID from 409 response");
          navigate('/rooms');
          return;
        }
      } else if (!response.ok) {
        console.error("[OnlineTab:handleMessageClick] Error creating PM:", responseData);
        throw new Error(responseData.message || "Failed to create conversation");
      }
      
      console.log("[OnlineTab:handleMessageClick] Created new PM:", responseData);
      
      // Navigate to the newly created PM
      navigate(`/rooms/${responseData.id}`);
      
    } catch (error) {
      console.error("[OnlineTab:handleMessageClick] Error:", error);
      // If there's an error, navigate to the rooms page instead of undefined
      navigate('/rooms');
    } finally {
      setIsCreatingPM(false);
    }
  };

  return (
    <div class="p-4 px-7 flex flex-col h-full overflow-hidden">
      <FriendSearch onSearch={setSearchQuery} />
      <Show
        when={onlineFriends().length > 0}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center text-text-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-16 h-16 mb-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="text-lg">
              {t("friends.emptyStates.noOnlineFriends")}
            </span>
          </div>
        }
      >
        <Show
          when={filteredFriends().length > 0}
          fallback={
            <div class="text-text-secondary text-center p-4">
              {searchQuery() ? t("friends.emptyStates.noSearchResults") : ""}
            </div>
          }
        >
          <h3 class="text-text-primary font-medium text-lg px-2 pb-4 mt-2">
            Online - {filteredFriends().length}
          </h3>
          <div class="overflow-y-auto flex-1 min-h-0">
            <For
              each={filteredFriends().sort((a, b) =>
                a.display_name.localeCompare(b.display_name),
              )}
            >
              {(friend) => (
                <div class="flex flex-col bg-background-secondary p-2 pb-3.5 border-t-2 border-t-border hover:bg-border hover:rounded-lg hover:cursor-pointer">
                  <div class="flex items-center gap-3">
                    {friend.avatar ? (
                      <div class="relative">
                        <div class="relative w-10 h-10">
                          <img
                            src={`${FS_URL}/avatars/${friend.id}/${friend.avatar}`}
                            alt="avatar"
                            class="w-full h-full rounded-full object-cover"
                            style={{ "aspect-ratio": "1/1" }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/path/to/fallback/image.jpg";
                            }}
                          />
                        </div>
                        <StatusIndicator status={friend.status as UserStatus} />
                      </div>
                    ) : (
                      <div class="relative">
                        <div class="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
                          <span class="text-text-secondary text-sm">
                            {friend.username[0].toUpperCase()}
                          </span>
                        </div>
                        <StatusIndicator status={friend.status as UserStatus} />
                      </div>
                    )}
                    <div class="flex flex-col flex-grow">
                      <span>{friend.display_name}</span>
                      <span class="text-text-secondary text-sm">
                        {friend.custom_status
                          ? `${friend.custom_status}`
                          : friend.status?.charAt(0).toUpperCase() +
                            friend.status?.slice(1)}
                      </span>
                    </div>
                    <div class="flex gap-2">
                      <Tooltip content="Message" position="top">
                        <button 
                          class="p-2 rounded-full transition-colors bg-border hover:bg-[rgba(68,68,68,0.4)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessageClick(friend.id);
                          }}
                          disabled={isCreatingPM()}
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
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                      </Tooltip>
                      <div class="relative">
                        <FriendMenu
                          friendId={friend.id}
                          friendName={friend.display_name}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};
