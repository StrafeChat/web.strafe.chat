import { Component } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import Key from "../../shared/icons/Key";
import Plus from "../../shared/icons/Plus";
import Shield from "../../shared/icons/Shield";

const OAuth2Settings: Component = () => {
  const [t] = useTransContext();

  return (
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Key />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.developers.oauth2.title")}
          </h2>
          <p class="text-text-secondary text-xs">
            {t("settings.developers.oauth2.description")}
          </p>
        </div>
      </div>

      {/* Content Sections */}
      <div class="space-y-6">
        {/* Create New Application Section */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <Plus />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">
              {t("settings.developers.oauth2.createNew")}
            </h3>
          </div>
          <p class="text-text-secondary text-sm mb-4">
            Create a new OAuth2 application to integrate with external services.
          </p>
          <button class="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all duration-200 font-medium flex items-center gap-2">
            <Plus />
            {t("settings.developers.oauth2.createButton")}
          </button>
        </div>

        {/* Existing Applications Section */}
        <div class="bg-background1 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-text-primary mb-4">
            {t("settings.developers.oauth2.existing")}
          </h3>
          <div class="text-center py-8">
            <div class="p-4 bg-background1 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Key />
            </div>
            <p class="text-text-secondary text-sm mb-2">
              {t("settings.developers.oauth2.noApps")}
            </p>
            <p class="text-text-tertiary text-xs">
              Your OAuth2 applications will appear here once you create them.
            </p>
          </div>
        </div>

        {/* Authorized Applications Section */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-green-500/10 rounded-lg">
              <Shield />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">
              {t("settings.developers.oauth2.authorized")}
            </h3>
          </div>
          <div class="text-center py-8">
            <div class="p-4 bg-background1 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Shield />
            </div>
            <p class="text-text-secondary text-sm mb-2">
              {t("settings.developers.oauth2.noAuthorized")}
            </p>
            <p class="text-text-tertiary text-xs">
              Applications you've authorized will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OAuth2Settings;