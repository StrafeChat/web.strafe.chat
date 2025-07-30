import { Component, Show, createSignal } from "solid-js";
import SpaceSettings from "../settings/SpaceSettings"; // Import the modal
import { FS_URL } from "../../constants";
import { Space } from "../../lib/providers/cache/CacheProvider";

interface SpaceHomeProps {
  space: Space | null | undefined;
}

export const SpaceHome: Component<SpaceHomeProps> = (props) => {
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);

  return (
    <div class="h-full w-full flex flex-col bg-background2 overflow-y-auto">
      {/* Space Banner */}
      <div class="relative h-[120px] overflow-hidden">
        {/* false is hardcoded here cause I don't really like the way the banner looks here, just gonna keep turtles for now.  */}
        <Show
          when={false}
          fallback={
            <>
              {/* Floating turtle background when no banner */}
              <div class="absolute inset-0 bg-[#1a1b26]">
                <div class="absolute inset-0 opacity-40">
                  <img
                    src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
                    alt="Turtle"
                    class="absolute w-24 h-24 animate-swim-1"
                    style={{ top: "20%", left: "10%" }}
                  />
                  <img
                    src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
                    alt="Turtle"
                    class="absolute w-16 h-16 animate-swim-2"
                    style={{ top: "60%", right: "15%" }}
                  />
                  <img
                    src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
                    alt="Turtle"
                    class="absolute w-20 h-20 animate-swim-3"
                    style={{ bottom: "15%", left: "30%" }}
                  />
                  <img
                    src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
                    alt="Turtle"
                    class="absolute w-16 h-16 animate-swim-1"
                    style={{ top: "40%", right: "30%" }}
                  />
                  <img
                    src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
                    alt="Turtle"
                    class="absolute w-24 h-24 animate-swim-2"
                    style={{ bottom: "30%", right: "40%" }}
                  />
                </div>
                <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>
              </div>
            </>
          }
        >
          <img
            src={`${FS_URL}/space_banners/${props.space?.id}/${props.space?.banner}`}
            alt="Space banner"
            class="w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-black bg-opacity-20" />
        </Show>

        <div class="absolute bottom-5 items-center left-4 flex gap-4">
          <div class="w-16 h-16 rounded-full bg-white bg-opacity-20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
            <Show
              when={props.space?.icon}
              fallback={
                <span class="text-2xl font-bold text-white">
                  {props.space?.name_acronym ||
                    props.space?.name?.charAt(0) ||
                    "S"}
                </span>
              }
            >
              <img
                src={`${FS_URL}/space_icons/${props.space?.id}/${props.space?.icon}`}
                alt="Space icon"
                class="w-full h-full object-cover"
              />
            </Show>
          </div>
          <div class="">
            <h1 class="text-2xl font-bold text-white truncate">
              {props.space?.name || "Unknown Space"}
            </h1>
            <Show when={props.space?.description}>
              <p class="text-white text-opacity-80 truncate">
                {props.space?.description}
              </p>
            </Show>
          </div>
        </div>
      </div>

      {/* Content section */}
      <div class="p-6">
        <div class="mb-6">
          {/* Space stats */}
          <div class="flex gap-4 text-sm text-text-secondary mb-4">
            <span>
              Created:{" "}
              {props.space?.created_at
                ? new Date(props.space.created_at).toLocaleDateString()
                : "Unknown"}
            </span>
            <span>•</span>
            {/* <span>Members: {props.space?.member_count || 0}</span> */}
          </div>
        </div>

        {/* Welcome section */}
        <div class="bg-background1 rounded-lg p-6 mb-6">
          <h2 class="text-lg font-semibold text-text-primary mb-3">
            Welcome to {props.space?.name || "this space"}!
          </h2>
          <p class="text-text-secondary mb-4">
            This is the home page for your space. Here you can see an overview
            of your community, recent activity, and important announcements.
          </p>

          {/* Quick actions */}
          <div class="flex flex-wrap gap-3">
            <button
              class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors text-sm font-medium"
              onClick={() => setIsSettingsOpen(true)}
            >
              Browse Rooms
            </button>
            <button
              class="px-4 py-2 bg-surface bg-opacity-20 text-text-primary rounded-md hover:bg-opacity-30 transition-colors text-sm font-medium"
              onClick={() => {
                setIsSettingsOpen(true);
              }}
            >
              View Members
            </button>
            <Show when={props.space?.owner_id}>
              <button
                class="px-4 py-2 bg-surface bg-opacity-20 text-text-primary rounded-md hover:bg-opacity-30 transition-colors text-sm font-medium"
                onClick={() => setIsSettingsOpen(true)}
              >
                Space Settings
              </button>
            </Show>
          </div>
        </div>

        {/* Recent activity placeholder */}
        <div class="bg-background1 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-text-primary mb-3">
            Recent Activity
          </h3>
          <div class="text-text-secondary text-center py-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-12 h-12 mx-auto mb-3 opacity-50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            <p>No recent activity to show</p>
            <p class="text-sm mt-1">
              Activity will appear here as members interact in your space
            </p>
          </div>
        </div>
      </div>
      {/* Space Settings Modal */}
      <Show when={isSettingsOpen()}>
        <SpaceSettings
          isOpen={isSettingsOpen()}
          onClose={() => setIsSettingsOpen(false)}
          spaceId={props.space?.id || ""}
        />
      </Show>
    </div>
  );
};
