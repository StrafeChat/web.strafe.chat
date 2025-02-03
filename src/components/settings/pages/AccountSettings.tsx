import { Component } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";

const AccountSettings: Component = () => {
  const { user, isMobile } = useAuth();
  const [t] = useTransContext();

  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      <h2 class="text-xl font-semibold text-text-primary mb-1">
        {t("settings.account.title")}
      </h2>
      <p class="text-text-secondary mb-5 text-xs">
        {t("settings.account.description")}
      </p>
      <div class="bg-background1 rounded-lg p-4">
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-text-primary">
            {user()?.display_name || user()?.username}
          </h3>
          <p class="text-text-secondary text-sm">
            {user()?.username}#{String(user()?.discriminator).padStart(4, "0")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
