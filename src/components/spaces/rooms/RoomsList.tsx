import { Component, createSignal } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import UserSettings from "../../settings/UserSettings";

const RoomsList: Component = () => {
  const { user } = useAuth();
  const [showSettings, setShowSettings] = createSignal(false);

  return (
    <div class="flex flex-col h-full bg-[var(--background1)] rounded-tl-2xl overflow-hidden">
      {/* Main content area - will flex-grow to fill space */}
      <div class="flex-1 overflow-y-auto pb-[80px] md:pb-0">
        {/* Add your rooms list content here */}
      </div>

      {/* User Info - will stay at bottom */}
      <div class="p-2 border-t border-border mt-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 hover:bg-surface hover:bg-opacity-10 transition-colors hover:cursor-pointer rounded-md px-2">
            <div class="relative w-8 h-8">
              <img
                src="https://cdn.discordapp.com/avatars/529815278456930314/718130faa9edf64dc453e04ee63fa1fe.png?format=webp&quality=lossless&width=897&height=897"
                alt="User avatar"
                draggable="false"
                class="w-full h-full rounded-full object-cover"
                style={{ "aspect-ratio": "1/1" }}
              />
            </div>
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

export default RoomsList;
