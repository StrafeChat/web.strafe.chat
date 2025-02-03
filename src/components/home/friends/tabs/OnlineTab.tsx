import { Component, For, Show, createMemo, createSignal } from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { Tooltip } from "../../../common/Tooltip";
import { FriendSearch } from "../FriendSearch";
import { FS_URL } from "../../../../constants";
import { StatusIndicator, UserStatus } from "../../../common/StatusIndicator";

export const OnlineTab: Component = () => {
  const { user, relationships } = useAuth();
  const cache = useCache();
  const [t] = useTransContext();
  const [searchQuery, setSearchQuery] = createSignal("");

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
        friend.display_name.toLowerCase().includes(query)
    );
  });

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
            <For each={filteredFriends()}>
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
          </div>
        </Show>
      </Show>
    </div>
  );
};
