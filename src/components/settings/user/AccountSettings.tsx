import { Component, createSignal } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import User from "../../shared/icons/User";
import Shield from "../../shared/icons/Shield";

const AccountSettings: Component = () => {
  const { user, isMobile } = useAuth();
  const [t] = useTransContext();
  const [emailRevealed, setEmailRevealed] = createSignal(false);

  const maskEmail = (email: string) => {
    if (!email) return "No email set";
    const [, domain] = email.split('@');
    if (!domain) return email;
    return `*****@${domain}`;
  };

  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <User />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.account.title")}
          </h2>
          <p class="text-text-secondary text-xs">
            {t("settings.account.description")}
          </p>
        </div>
      </div>

      {/* Account Information */}
      <div class="space-y-6">
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-primary/10 rounded-lg">
              <User />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Account Information</h3>
          </div>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Display Name</label>
              <div class="p-3 bg-background2 border border-border rounded-lg text-text-primary">
                {user()?.display_name || user()?.username}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Username</label>
              <div class="p-3 bg-background2 border border-border rounded-lg text-text-primary font-mono">
                {user()?.username}#{String(user()?.discriminator).padStart(4, "0")}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Email</label>
              <div class="p-3 bg-background2 border border-border rounded-lg text-text-primary">
                <span class="inline">
                  {emailRevealed() ? (user()?.email || "No email set") : maskEmail(user()?.email || "")}
                </span>
                <button 
                  onClick={() => setEmailRevealed(!emailRevealed())}
                  class="ml-2 text-primary hover:text-primary-dark hover:underline transition-colors text-sm font-medium underline cursor-pointer"
                >
                  {emailRevealed() ? "Hide" : "Reveal"}
                </button>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-text-primary">Password</label>
              <div class="flex items-center gap-3">
                <div class="flex-1 p-3 bg-background2 border border-border rounded-lg text-text-secondary">
                  ••••••••••••
                </div>
                <button class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm">
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div class="bg-background1 rounded-lg p-6">
          <div class="flex items-center gap-4 mb-4">
            <div class="p-2 bg-yellow-500/10 rounded-lg">
              <Shield />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">Security</h3>
          </div>
          <div class="space-y-4">
            <div class="p-4 bg-background2 border border-border rounded-lg">
              <h4 class="text-text-primary font-medium mb-2">Two-Factor Authentication</h4>
              <p class="text-text-secondary text-sm mb-3">Add an extra layer of security to your account</p>
              <button class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
