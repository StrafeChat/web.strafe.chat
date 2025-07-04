import { Component } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useUserSettings } from "../../../lib/providers/userSettings/UserSettingsProvider";

const PrivacySettings: Component = () => {
  const [t] = useTransContext();
  const { userSettings, toggleSendTypingIndicators } = useUserSettings();

  return (
    <div class="mb-8">
      <h2 class="text-xl font-semibold text-text-primary mb-1">
        {t("settings.privacy.title")}
      </h2>
      <p class="text-text-secondary mb-5 text-xs">
        {t("settings.privacy.description")}
      </p>
      
      {/* Privacy Options Section */}
      <div class="mt-8">
        <h3 class="text-lg font-semibold text-text-primary mb-3">Privacy Options</h3>
        <div class="bg-surface rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <h4 class="text-base font-medium text-text-primary mb-1">
                Send Typing Indicators
              </h4>
              <p class="text-sm text-text-secondary">
                Allow others to see when you're typing in a room
              </p>
            </div>
            <button
              onClick={toggleSendTypingIndicators}
              class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                userSettings().privacy.sendTypingIndicators
                  ? "bg-primary"
                  : "bg-gray-600"
              }`}
            >
              <span
                class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  userSettings().privacy.sendTypingIndicators
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettings;