import { Component, createSignal } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";
import { Avatar } from "../common/Avatar";
import { Tooltip } from "../common/Tooltip";
import Settings from "./icons/Settings";
import UserSettings from "../settings/UserSettings";
import ClientUserPopup from "../common/ClientUserPopup";
import { capitalizeStatus } from "../../lib/utils/status";
import { Portal } from "solid-js/web";
import { Show } from "solid-js";

export const ClientUserArea: Component = () => {
  const { user } = useAuth();
  const [t] = useTransContext();
  const [showSettings, setShowSettings] = createSignal(false);
  const [showUserPopup, setShowUserPopup] = createSignal(false);
  const [userProfileTrigger, setUserProfileTrigger] = createSignal<HTMLDivElement>();
  const [customStatus, setCustomStatus] = createSignal("");
  const [customEmoji, setCustomEmoji] = createSignal("");

  return (
    <>
      <Show when={window.innerWidth > 768}>
        <div class="border-t border-border mt-auto">
          <div class="flex items-center bg-background1 pl-1.5 pr-2 py-1 w-full">
            <div class="flex-1 min-w-0 flex items-center overflow-hidden">
              <div
                class="group inline-flex items-center gap-2 hover:bg-surface hover:bg-opacity-10 transition-colors hover:cursor-pointer rounded-md pl-1 pr-2 py-1 overflow-hidden"
                onClick={() => setShowUserPopup(true)}
                ref={setUserProfileTrigger}
              >
                <div class="relative flex items-center flex-shrink-0">
                  <div class="relative w-8 h-8">
                    <Avatar
                      userId={user()?.id!}
                      size="sm"
                      avatar={user()?.avatar}
                      alt="Avatar"
                    />
                  </div>
                  <StatusIndicator
                    status={(user()?.presence?.status || "offline") as UserStatus}
                    class="border-background1 group-hover:border-surface group-hover:border-opacity-10 transition-colors"
                  />
                </div>
                <div class="min-w-0 overflow-hidden">
                  <div class="text-sm font-medium truncate select-none">
                    {user()?.display_name}
                  </div>
                  <div class="text-xs text-text-secondary truncate select-none">
                    {user()?.presence?.custom_status ||
                      capitalizeStatus(user()?.presence?.status || "offline")}
                  </div>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0 ml-2">
              {/* Client User Popup */}
              <ClientUserPopup
                isOpen={showUserPopup()}
                onClose={() => setShowUserPopup(false)}
                triggerRef={userProfileTrigger()}
                customStatus={customStatus()}
                setCustomStatus={setCustomStatus}
                customEmoji={customEmoji()}
                setCustomEmoji={setCustomEmoji}
              />
              {/* User Settings Modal */}
              <Tooltip content={t("settings.sections.user")} position="top">
                <button
                  class="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-surface hover:bg-opacity-10"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </Show>
      <Portal>
        <UserSettings
          isOpen={showSettings()}
          onClose={() => setShowSettings(false)}
        />
      </Portal>
    </>
  );
};