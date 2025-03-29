import { Component } from "solid-js";
import { ThemeSwitcher } from "../../shared/ThemeSwitcher";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useUserSettings } from "../../../lib/providers/userSettings/UserSettingsProvider";

const AppearanceSettings: Component = () => {
  const [t] = useTransContext();
  const { userSettings, toggleAlwaysShowSendButton, toggleTimeFormat } = useUserSettings();

  return (
    <div class="mb-8">
      <h2 class="text-xl font-semibold text-text-primary mb-1">
        {t("settings.appearance.title")}
      </h2>
      <p class="text-text-secondary mb-5 xs text-xs">
        {t("settings.appearance.description")}
      </p>
      <ThemeSwitcher />
      
      {/* Other Options Section */}
      <div class="mt-8">
        <h3 class="text-lg font-semibold text-text-primary mb-3">Other Options</h3>
        <div class="bg-surface rounded-lg p-4">
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-text-primary font-medium">Always show send button</h4>
                <p class="text-text-secondary text-sm">Show the send button on desktop even when not typing</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  class="sr-only peer" 
                  checked={userSettings().appearance.alwaysShowSendButton}
                  onChange={toggleAlwaysShowSendButton}
                />
                <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-text-primary font-medium">Use 24-hour time format</h4>
                <p class="text-text-secondary text-sm">Display time in 24-hour format (e.g., 14:00) instead of 12-hour format (e.g., 2:00 PM)</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  class="sr-only peer" 
                  checked={userSettings().appearance.use24HourFormat}
                  onChange={toggleTimeFormat}
                />
                <div class="w-11 h-6 bg-background1 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
