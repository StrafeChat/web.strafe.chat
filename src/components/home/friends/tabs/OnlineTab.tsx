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
import { FS_URL } from "../../../../constants";
import { StatusIndicator, UserStatus } from "../../../common/StatusIndicator";

type FriendData = {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  status: UserStatus;
  custom_status: string;
};

export const OnlineTab: Component = () => {
  const { user, relationships } = useAuth();
  const cache = useCache();
  const [searchQuery, setSearchQuery] = createSignal("");

  console.log("[OnlineTab:Initial] Auth context loaded");

  const onlineFriends = createMemo(() => {
    console.log("[OnlineTab:friends] Starting friends memo computation");

    const currentUser = user();
    console.log("[OnlineTab:friends] Current user:", currentUser);

    const friendIds = relationships();
    console.log(
      "[OnlineTab:friends] Friend IDs from relationships:",
      friendIds
    );

    if (!currentUser?.id) {
      console.log("[OnlineTab:friends] No current user ID");
      return [] as const;
    }

    if (!friendIds?.length) {
      console.log("[OnlineTab:friends] No friend IDs found");
      return [] as const;
    }

    const users = cache.users();
    console.log("[OnlineTab:friends] All cached users:", users);

    const mappedFriends = friendIds
      .map((friendId) => {
        console.log("[OnlineTab:friends] Processing friend ID:", friendId);
        const friend = cache.getUser(friendId);
        console.log("[OnlineTab:friends] Found friend in cache:", friend);

        if (!friend?.username) {
          console.log("[OnlineTab:friends] Friend missing username:", friend);
          return null;
        }

        // Only include friends who are online
        if (
          !friend.presence?.status ||
          friend.presence.status.toLowerCase() === "offline"
        ) {
          console.log(
            "[OnlineTab:friends] Friend is offline or has no status:",
            {
              friendId,
              presence: friend.presence,
              status: friend.presence?.status,
            }
          );
          return null;
        }

        console.log("[OnlineTab:friends] Including online friend:", {
          friendId,
          presence: friend.presence,
          status: friend.presence?.status,
        });

        const isValidUserStatus = (
          status: string | undefined
        ): status is UserStatus => {
          return (
            status === "online" ||
            status === "idle" ||
            status === "dnd" ||
            status === "offline"
          );
        };

        const friendData: FriendData = {
          id: friend.id,
          username: friend.username,
          display_name: friend.display_name || friend.username,
          avatar: friend.avatar,
          status: isValidUserStatus(friend.presence?.status)
            ? friend.presence.status
            : "offline",
          custom_status: friend.presence?.custom_status || "",
        };

        console.log("[OnlineTab:friends] Mapped friend data:", friendData);
        return friendData;
      })
      .filter((friend): friend is FriendData => Boolean(friend))
      .filter((friend) => {
        if (!searchQuery()) return true;
        const query = searchQuery().toLowerCase();
        return (
          friend.username.toLowerCase().includes(query) ||
          friend.display_name.toLowerCase().includes(query)
        );
      });

    console.log("[OnlineTab:friends] Final mapped friends:", mappedFriends);
    return mappedFriends;
  });

  createEffect(() => {
    console.log(
      "[OnlineTab:effect] Current online friends list:",
      onlineFriends()
    );
  });

  return (
    <div class="p-4 px-7 mb-5 flex flex-col">
      <FriendSearch onSearch={setSearchQuery} />
      <Show
        when={onlineFriends().length > 0}
        fallback={
          <div class="text-text-secondary text-center p-4">
            {searchQuery()
              ? "No friends found matching your search."
              : "None of your friends are online right now."}
          </div>
        }
      >
        <h3 class="text-text-primary font-medium text-lg px-2 pb-4 mt-2">
          Online - {onlineFriends().length}
        </h3>
        <For each={onlineFriends()}>
          {(friend: FriendData | null) =>
            friend && (
              <div class="flex flex-col bg-background-secondary p-2 pb-3.5 border-t-2 border-t-border hover:bg-border hover:rounded-lg hover:cursor-pointer">
                <div class="flex items-center gap-3">
                  {friend.avatar ? (
                    <div class="relative">
                      <img
                        src={`${FS_URL}/avatars/${friend.id}/${friend.avatar}`}
                        alt="avatar"
                        class="w-10 h-10 rounded-full"
                      />
                      <StatusIndicator status={friend.status} />
                    </div>
                  ) : (
                    <div class="relative">
                      <div class="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
                        <span class="text-text-secondary text-sm">
                          {friend.username[0].toUpperCase()}
                        </span>
                      </div>
                      <StatusIndicator status={friend.status} />
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
                  <div class="flex">
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
            )
          }
        </For>
      </Show>
    </div>
  );
};
