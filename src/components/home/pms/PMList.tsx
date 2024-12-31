import { Component, createMemo, createSignal, Show } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import UserSettings from "../../settings/UserSettings";
import { A } from "@solidjs/router";

export const PMList: Component = () => {
  const { relationshipRequests, user } = useAuth();
  const [showSettings, setShowSettings] = createSignal(false);

  const pendingCount = createMemo(() => {
    const currentUser = user();
    const currentRelationships = relationshipRequests();
    if (!currentUser?.id || !currentRelationships) return 0;

    return currentRelationships.filter(
      (rel) => rel.recipient_id === currentUser.id
    ).length;
  });

  return (
    <div class="flex flex-col h-full bg-background1 rounded-tl-2xl">
      <div class="p-2 flex flex-col border-b border-border">
        <h2 class="text-xl px-3 py-2 font-bold text-text-primary select-none">
          Private Messages
        </h2>
      </div>

      <div class="flex flex-col gap-1 p-2">
        <A
          href="/"
          class="flex items-center gap-2 p-3   rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span class="text-sm font-medium">Home</span>
        </A>
        <A
          href="/friends"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span class="text-sm font-medium">Friends</span>
          <Show when={pendingCount() > 0}>
            <div class="ml-auto bg-red-500 text-white text-xs w-[20px] h-[20px] rounded-full grid place-items-center">
              {pendingCount()}
            </div>
          </Show>
        </A>
        {/* <A
          href="/notes"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span class="text-sm font-medium">Notes</span>
        </A> */}
      </div>

      <div class="p-2 border-t border-border mt-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 hover:bg-surface hover:bg-opacity-10 transition-colors hover:cursor-pointer rounded-md px-2">
            <img
              src="https://cdn.discordapp.com/avatars/529815278456930314/718130faa9edf64dc453e04ee63fa1fe.png?format=webp&quality=lossless&width=897&height=897"
              alt="User avatar"
              draggable="false"
              class="w-8 h-8 rounded-full object-cover"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {user()?.display_name}
              </div>
              <div class="text-xs text-text-secondary truncate">Online</div>
            </div>
          </div>
          <button
            class="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-surface hover:bg-opacity-10"
            onClick={() => setShowSettings(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>
      {/* User Settings Modal */}
      <UserSettings
        isOpen={showSettings()}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};
