import { Component } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import Robot from "../../shared/icons/Robot";
import Plus from "../../shared/icons/Plus";

const BotsSettings: Component = () => {
  const [t] = useTransContext();

  return (
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Robot />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.developers.bots.title")}
          </h2>
          <p class="text-text-secondary text-xs">
            {t("settings.developers.bots.description")}
          </p>
        </div>
      </div>

      {/* Content Sections */}
      <div class="space-y-6">
        {/* Create New Bot Section */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <Plus />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">
              {t("settings.developers.bots.createNew")}
            </h3>
          </div>
          <p class="text-text-secondary text-sm mb-4">
            Create a new bot to automate tasks and enhance your server experience.
          </p>
          <button class="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all duration-200 font-medium flex items-center gap-2">
            <Plus />
            {t("settings.developers.bots.createButton")}
          </button>
        </div>

        {/* Existing Bots Section */}
        <div class="bg-background1 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-text-primary mb-4">
            {t("settings.developers.bots.existing")}
          </h3>
          <div class="text-center py-8">
            <div class="p-4 bg-background1 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Robot />
            </div>
            <p class="text-text-secondary text-sm mb-2">
              {t("settings.developers.bots.noBots")}
            </p>
            <p class="text-text-tertiary text-xs">
              Your created bots will appear here once you create them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotsSettings;