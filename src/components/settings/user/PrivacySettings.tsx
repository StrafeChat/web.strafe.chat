import { Component } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useUserSettings } from "../../../lib/providers/userSettings/UserSettingsProvider";
import Shield from "../../shared/icons/Shield";

const PrivacySettings: Component = () => {
  const [t] = useTransContext();
  const { userSettings, toggleSendTypingIndicators } = useUserSettings();

  return (
    <div class="mb-8">
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Shield />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.privacy.title")}
          </h2>
          <p class="text-text-secondary text-xs">
            {t("settings.privacy.description")}
          </p>
        </div>
      </div>
      
      {/* Privacy Options Section */}
      <div class="bg-background1 rounded-lg p-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-green-500/10 rounded-lg">
            <Shield />
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Privacy Options</h3>
        </div>
        <div class="bg-background2 rounded-lg p-4">
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