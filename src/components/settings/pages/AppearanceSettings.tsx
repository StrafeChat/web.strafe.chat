import { Component } from "solid-js";
import { ThemeSwitcher } from "../../shared/ThemeSwitcher";
import { useTransContext } from "@mbarzda/solid-i18next";

const AppearanceSettings: Component = () => {
  const [t] = useTransContext();

  return (
    <div class="mb-8">
      <h2 class="text-xl font-semibold text-text-primary mb-1">
        {t("settings.appearance.title")}
      </h2>
      <p class="text-text-secondary mb-5 xs text-xs">
        {t("settings.appearance.description")}
      </p>
      <ThemeSwitcher />
    </div>
  );
};

export default AppearanceSettings;
