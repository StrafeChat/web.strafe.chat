import {
  Component,
  For,
  Show,
  createMemo,
  createEffect,
  createSignal,
} from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { Tooltip } from "../../../common/Tooltip";
import { FriendSearch } from "../FriendSearch";

type FriendData = {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  status: string;
  custom_status: string;
};

export const AllTab: Component = () => {
  const { user, relationships } = useAuth();
  const cache = useCache();
  const [searchQuery, setSearchQuery] = createSignal("");

  console.log("[AllTab:Initial] Auth context loaded");

  const friends = createMemo(() => {
    console.log("[AllTab:friends] Starting friends memo computation");

    const currentUser = user();
    console.log("[AllTab:friends] Current user:", currentUser);

    const friendIds = relationships();
    console.log("[AllTab:friends] Friend IDs from relationships:", friendIds);

    if (!currentUser?.id) {
      console.log("[AllTab:friends] No current user ID");
      return [] as const;
    }

    if (!friendIds?.length) {
      console.log("[AllTab:friends] No friend IDs found");
      return [] as const;
    }

    const users = cache.users();
    console.log("[AllTab:friends] All cached users:", users);

    const mappedFriends = friendIds
      .map((friendId) => {
        console.log("[AllTab:friends] Processing friend ID:", friendId);
        const friend = cache.getUser(friendId);
        console.log("[AllTab:friends] Found friend in cache:", friend);

        if (!friend?.username) {
          console.log("[AllTab:friends] Friend missing username:", friend);
          return null;
        }

        const friendData: FriendData = {
          id: friend.id,
          username: friend.username,
          display_name: friend.display_name || friend.username,
          avatar: friend.avatar,
          status: friend.presence?.status || "Offline",
          custom_status: friend.presence?.custom_status || "",
        };
        console.log("[AllTab:friends] Created friend data:", friendData);
        return friendData;
      })
      .filter((friend): friend is FriendData => friend !== null);

    console.log("[AllTab:friends] Final mapped friends:", mappedFriends);
    return mappedFriends;
  }) as () => FriendData[];

  const filteredFriends = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return friends();

    return friends().filter(
      (friend) =>
        friend.username.toLowerCase().includes(query) ||
        friend.display_name.toLowerCase().includes(query) ||
        friend.id.toLowerCase().includes(query)
    );
  });

  createEffect(() => {
    console.log("[AllTab:effect] Current friends list:", friends());
  });

  return (
    <div class="p-4 px-7 mb-5 flex flex-col">
      <FriendSearch onSearch={setSearchQuery} />
      <Show
        when={filteredFriends().length > 0}
        fallback={
          <div class="text-text-secondary text-center p-4">
            {searchQuery()
              ? "No friends found matching your search."
              : "No friends added yet. Add some friends to get started!"}
          </div>
        }
      >
        <h3 class="text-text-primary font-medium text-lg px-2 pb-4 mt-2">
          All - {filteredFriends().length}
        </h3>
        <For each={filteredFriends()}>
          {(friend) => (
            <div class="flex flex-col bg-background-secondary p-2 pb-3.5 border-t-2 border-t-border hover:bg-border hover:rounded-lg hover:cursor-pointer">
              <div class="flex items-center">
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
                    {friend.custom_status
                      ? `(${friend.custom_status})`
                      : friend.status?.charAt(0).toUpperCase() +
                        friend.status?.slice(1)}
                  </span>
                </div>
                <div class="flex gap-2">
                  <Tooltip content="Message" position="top">
                    <button class="p-2 rounded-full transition-colors bg-border hover:bg-[rgba(68,68,68,0.4)]">
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
