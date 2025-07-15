import { Component } from "solid-js";
import { ThemeSwitcher } from "../../shared/ThemeSwitcher";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useUserSettings } from "../../../lib/providers/userSettings/UserSettingsProvider";
import Palette from "../../shared/icons/Palette";
import Settings from "../../shared/icons/Settings";

const AppearanceSettings: Component = () => {
  const [t] = useTransContext();
  const { userSettings, toggleAlwaysShowSendButton, toggleTimeFormat } = useUserSettings();

  return (
    <div class="mb-8">
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Palette />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.appearance.title")}
          </h2>
          <p class="text-text-secondary text-xs">
            {t("settings.appearance.description")}
          </p>
        </div>
      </div>

      {/* Theme Section */}
      <div class="bg-background1 rounded-lg p-6 mb-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-primary/10 rounded-lg">
            <Palette />
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Theme</h3>
        </div>
        <ThemeSwitcher />
      </div>
      
      {/* Other Options Section */}
      <div class="bg-background1 rounded-lg p-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-blue-500/10 rounded-lg">
            <Settings />
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Other Options</h3>
        </div>
        <div class="bg-background2 rounded-lg p-4">
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
