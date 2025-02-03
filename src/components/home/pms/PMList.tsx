import { Component, createSignal, createMemo, Show } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import UserSettings from "../../settings/UserSettings";
import ClientUserPopup from "../../common/ClientUserPopup";
import { A } from "@solidjs/router";
import { Tooltip } from "../../common/Tooltip";
import { useTransContext } from "@mbarzda/solid-i18next";
import { StatusIndicator, UserStatus } from "../../common/StatusIndicator";
import { FS_URL } from "../../../constants";
import Home from "../../shared/icons/Home";
import Friends from "../../shared/icons/Friends";
import Notes from "../../shared/icons/Notes";
import PlusSmall from "../../shared/icons/PlusSmall";
import Settings from "../../shared/icons/Settings";
import { capitalizeStatus } from "../../../lib/utils/status";

export const PMList: Component = () => {
  const { relationshipRequests, user } = useAuth();
  const [t] = useTransContext();
  const [showSettings, setShowSettings] = createSignal(false);
  const [showUserPopup, setShowUserPopup] = createSignal(false);
  const [userProfileTrigger, setUserProfileTrigger] = createSignal<HTMLDivElement>();
  const [customStatus, setCustomStatus] = createSignal("");
  const [customEmoji, setCustomEmoji] = createSignal("");

  const pendingCount = createMemo(() => {
    const currentUser = user();
    const currentRelationships = relationshipRequests();
    if (!currentUser?.id || !currentRelationships) return 0;

    return currentRelationships.filter(
      (rel) => rel.recipient_id === currentUser.id
    ).length;
  });

  return (
    <div class="flex flex-col h-full bg-background1 rounded-tl-2xl">
      <div class="p-2 flex flex-col [box-shadow:0_2px_4px_-2px_rgba(0,0,0,0.2)]">
        <h2 class="text-xl px-3 py-2 font-bold text-text-primary select-none">
          {t("pms.title")}
        </h2>
      </div>

      <div class="flex flex-col gap-1 p-2">
        <A
          href="/"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <Home />
          <span class="text-text-primary select-none">{t("navigation.home")}</span>
        </A>

        <A
          href="/friends"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <Friends />
          <span class="text-text-primary select-none">{t("navigation.friends")}</span>
          <Show when={pendingCount() > 0}>
            <div class="ml-auto">
              <div class="bg-red-500 text-white text-xs font-medium px-2.5 py-0.5 rounded-full select-none">
                {pendingCount()}
              </div>
            </div>
          </Show>
        </A>

        <A
          href="/notes"
          class="flex items-center gap-2 p-3 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors"
          activeClass="bg-surface bg-opacity-10"
          end
        >
          <Notes />
          <span class="text-text-primary select-none">{t("navigation.notes")}</span>
        </A>

        <div class="mt-6 mb-2 pl-3 pr-2 flex items-center">
          <span class="text-xs font-bold text-text-primary tracking-wide uppercase select-none">
            {t("pms.conversations")}
          </span>
          <div class="ml-auto">
            <Tooltip content={t("pms.createPM")} position="top">
              <button class="w-6 h-6 rounded-full hover:bg-surface hover:bg-opacity-10 transition-colors grid place-items-center text-text-primary">
                <PlusSmall />
              </button>
            </Tooltip>
          </div>
        </div>

        <div class="text-text-secondary text-sm px-3 py-2 select-none">
          {t("pms.comingSoon")}
        </div>
      </div>

      <div class="border-t border-border mt-auto">
        <div class="flex items-center justify-between bg-background1 pl-1.5 pr-2 py-1">
          <div
            class="group flex items-center gap-2 hover:bg-surface hover:bg-opacity-10 transition-colors hover:cursor-pointer rounded-md pl-1 pr-2 py-1"
            onClick={() => setShowUserPopup(true)}
            ref={setUserProfileTrigger}
          >
            <div class="relative flex items-center flex-shrink-0">
              <div class="relative w-8 h-8">
                <img
                  src={`${FS_URL}/avatars/${user()?.id}/${
                    user()?.avatar || "favicon.ico"
                  }`}
                  alt="User avatar"
                  draggable="false"
                  class="w-full h-full rounded-full object-cover"
                  style={{ "aspect-ratio": "1/1" }}
                />
              </div>
              <StatusIndicator
                status={(user()?.presence?.status || "offline") as UserStatus}
                class="border-background1 group-hover:border-surface group-hover:border-opacity-10 transition-colors"
              />
            </div>
            <div class="min-w-0 max-w-[200px]">
              <div class="text-sm font-medium truncate select-none">
                {user()?.display_name}
              </div>
              <div class="text-xs text-text-secondary truncate select-none">
                {user()?.presence?.custom_status ||
                  capitalizeStatus(user()?.presence?.status || "offline")}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
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
      <UserSettings
        isOpen={showSettings()}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};
