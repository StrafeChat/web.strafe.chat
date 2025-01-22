import { Component } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";

export const Home: Component = () => {
  const [t] = useTransContext();

  return (
    <div class="flex flex-col h-full bg-background2">
      <div class="p-2 flex flex-col [box-shadow:0_2px_4px_-2px_rgba(0,0,0,0.2)]">
        <div class="flex items-center gap-2 px-3 py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 text-text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <h2 class="text-xl font-semibold text-text-primary">
            {t("home.title")}
          </h2>
        </div>
      </div>
      <div class="flex flex-col items-center justify-center flex-1 p-4 md:p-8 overflow-y-auto">
        <h1 class="text-4xl md:text-6xl font-bold text-center mb-4 md:mb-8">
          {t("home.welcome")} <br />
          <span class="font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            STRAFE
          </span>
        </h1>
        <div class="w-full max-w-7xl mx-auto mt-4 md:mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div class="bg-surface p-4 md:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h3 class="text-lg md:text-xl font-semibold mb-2">
              {t("home.cards.settings")}
            </h3>
            <p class="mb-4 text-sm md:text-base">
              {t("home.cards.settingsDescription")}
            </p>
            <button class="w-full md:w-auto bg-accent text-text-primary px-4 py-2 rounded hover:bg-primary-dark transition-colors">
              {t("home.cards.exploreSettings")}
            </button>
          </div>
          <div class="bg-surface p-4 md:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h3 class="text-lg md:text-xl font-semibold mb-2">
              {t("home.cards.community")}
            </h3>
            <p class="mb-4 text-sm md:text-base">
              {t("home.cards.communityDescription")}
            </p>
            <button class="w-full md:w-auto bg-accent text-text-primary px-4 py-2 rounded hover:bg-accent-dark transition-colors">
              {t("home.cards.joinCommunity")}
            </button>
          </div>
          <div class="bg-surface p-4 md:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h3 class="text-lg md:text-xl font-semibold mb-2">
              {t("home.cards.donate")}
            </h3>
            <p class="mb-4 text-sm md:text-base">
              {t("home.cards.donateDescription")}
            </p>
            <button class="w-full md:w-auto bg-accent text-text-primary px-4 py-2 rounded hover:bg-secondary-dark transition-colors">
              {t("home.cards.supportUs")}
            </button>
          </div>
          <div class="bg-surface p-4 md:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h3 class="text-lg md:text-xl font-semibold mb-2">
              {t("home.cards.discover")}
            </h3>
            <p class="mb-4 text-sm md:text-base">
              {t("home.cards.discoverDescription")}
            </p>
            <button class="w-full md:w-auto bg-accent text-text-primary px-4 py-2 rounded hover:bg-secondary-dark transition-colors">
              {t("home.cards.exploreMore")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
