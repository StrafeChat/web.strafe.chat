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
        <div class="flex flex-col md:flex-row items-center md:items-start gap-4">
          <img
            src="https://cdn.discordapp.com/avatars/529815278456930314/718130faa9edf64dc453e04ee63fa1fe.png?format=webp&quality=lossless&width=897&height=897"
            alt={t("settings.account.avatar.alt")}
            class="w-20 h-20 rounded-full object-cover"
          />
          <div class="flex-1 text-center md:text-left">
            <div class="text-lg font-medium text-text-primary">
              {user()!.username}
            </div>
            <div class="text-sm text-text-secondary">
              {t("settings.account.status.online")}
            </div>
          </div>
          <button class="px-4 py-2 bg-primary text-text-inverse rounded hover:brightness-110 transition-all">
            {t("settings.account.editProfile")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
