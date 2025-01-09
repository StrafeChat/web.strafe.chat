import { Component, For, Show, createMemo } from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { Tooltip } from "../../../common/Tooltip";

type FriendData = {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  status: string;
  online: boolean;
  custom_status: string;
};

export const AllTab: Component = () => {
  const { user } = useAuth();
  const cache = useCache();

  const friends = createMemo(() => {
    const currentUser = user();
    if (!currentUser?.friends?.length) return [] as const;

    return currentUser.friends
      .map(friendId => {
        const friend = cache.getUser(friendId);
        if (!friend?.username) return null;
        
        const friendData: FriendData = {
          id: friend.id,
          username: friend.username,
          display_name: friend.display_name || friend.username,
          avatar: friend.avatar,
          status: friend.presence?.status || "offline",
          online: friend.presence?.online || false,
          custom_status: friend.presence?.custom_status || "",
        };
        return friendData;
      })
      .filter((friend): friend is FriendData => friend !== null);
  }) as () => FriendData[];

  return (
    <div class="p-4 flex flex-col gap-2">
      <Show
        when={friends().length > 0}
        fallback={
          <div class="text-text-secondary text-center p-4">
            No friends added yet. Add some friends to get started!
          </div>
        }
      >
        <h3 class="text-text-primary font-medium">
          All - {friends().length}
        </h3>
        <For each={friends()}>
          {(friend) => (
            <div class="flex flex-col bg-background-secondary rounded-lg p-3">
              <div class="flex items-center gap-3 text-text-primary">
                {friend.avatar ? (
                  <img
                    src={friend.avatar}
                    alt="avatar"
                    class="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div class="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
                    {friend.display_name.charAt(0)}
                  </div>
                )}
                <div class="flex flex-col flex-grow">
                  <span>{friend.display_name}</span>
                  <span class="text-text-secondary text-sm">
                    {friend.online ? friend.status : "Offline"}
                    {friend.custom_status && ` • ${friend.custom_status}`}
                  </span>
                </div>
                <div class="flex gap-2">
                  <Tooltip content="Message" position="top">
                    <button class="p-2 hover:bg-background-tertiary rounded-full transition-colors">
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
                </div>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};
