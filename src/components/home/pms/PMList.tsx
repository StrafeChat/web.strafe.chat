import { Component, createSignal, createMemo, Show } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import UserSettings from "../../settings/UserSettings";
import { A } from "@solidjs/router";
import { Tooltip } from "../../common/Tooltip";

interface PMListProps {
  onCreatePM: () => void;
}

export const PMList: Component<PMListProps> = (props) => {
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
      <div class="p-2 flex flex-col [box-shadow:0_2px_4px_-2px_rgba(0,0,0,0.2)]">
        <h2 class="text-xl px-3 py-2 font-bold text-text-primary select-none">
          Private Messages
        </h2>
      </div>

      <div class="flex flex-col gap-1 p-2">
        <A
          href="/"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
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
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span class="text-text-primary select-none">Home</span>
        </A>

        <A
          href="/friends"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span class="text-text-primary select-none">Friends</span>
          <Show when={pendingCount() > 0}>
            <div class="ml-auto">
              <div class="bg-red-500 text-white text-xs font-medium px-2.5 py-0.5 rounded-full select-none">
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
            <path d="M18 2H6C5 2 4 3 4 4v16c0 1 1 2 2 2h12c1 0 2-1 2-2V4c0-1-1-2-2-2z" />
            <path d="M18 2l3 3h-3V2" />
            <path d="M8 8h8" />
            <path d="M8 12h8" />
            <path d="M8 16h8" />
          </svg>
          <span class="text-text-primary select-none">Notes</span>
        </A>

        <div class="mt-6 mb-2 pl-3 pr-2 flex items-center">
          <span class="text-xs font-bold text-text-primary tracking-wide uppercase select-none">
            CONVERSATIONS
          </span>
          <div class="ml-auto">
            <Tooltip content="Create PM" position="top">
              <button
                class="w-6 h-6 rounded-full hover:bg-surface hover:bg-opacity-10 transition-colors grid place-items-center text-text-primary"
                onClick={props.onCreatePM}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>

        <div class="text-text-secondary text-sm px-3 py-2 select-none">
          Private messages and group chats coming soon...
        </div>
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
              <div class="text-sm font-medium truncate select-none">
                {user()?.display_name}
              </div>
              <div class="text-xs text-text-secondary truncate select-none">
                Online
              </div>
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
