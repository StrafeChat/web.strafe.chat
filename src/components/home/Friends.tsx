import { Component, createSignal } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";

export const Friends: Component = () => {
  const [t] = useTransContext();
  const [activeTab, setActiveTab] = createSignal("online");

  return (
    <div class="flex flex-col h-full bg-background2">
      <div class="p-2 flex flex-col border-b border-border">
        <div class="flex items-center justify-between px-3 py-2 h-[44px]">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-6 h-6 text-text-primary"
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
              <h2 class="text-xl font-semibold text-text-primary">{t("friends.title")}</h2>
            </div>
            <div class="h-6 w-[1px] bg-border mx-1"></div>
            <div class="flex gap-2">
              <button
                class={`px-2 py-0.5 rounded transition-colors ${
                  activeTab() === "online"
                    ? "bg-accent text-white"
                    : "hover:bg-surface text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab("online")}
              >
                {t("friends.tabs.online")}
              </button>
              <button
                class={`px-2 py-0.5 rounded-md transition-colors ${
                  activeTab() === "all"
                    ? "bg-accent text-white"
                    : "hover:bg-surface text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab("all")}
              >
                {t("friends.tabs.all")}
              </button>
              <button
                class={`px-2 py-0.5 rounded-md transition-colors ${
                  activeTab() === "pending"
                    ? "bg-accent text-white"
                    : "hover:bg-surface text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab("pending")}
              >
                {t("friends.tabs.pending")}
              </button>
              <button
                class={`px-2 py-0.5 rounded-md transition-colors ${
                  activeTab() === "blocked"
                    ? "bg-accent text-white"
                    : "hover:bg-surface text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab("blocked")}
              >
                {t("friends.tabs.blocked")}
              </button>
            </div>
          </div>
          <button class="px-4 py-0.5 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
            {t("friends.addFriend")}
          </button>
        </div>
      </div>
      <div class="flex flex-col items-center justify-center flex-1 p-4 md:p-8 overflow-y-auto">
        <div class="text-center">
          <h3 class="text-xl font-semibold mb-2">{t("friends.noFriends.title")}</h3>
          <p class="text-text-secondary">{t("friends.noFriends.description")}</p>
        </div>
      </div>
    </div>
  );
};
