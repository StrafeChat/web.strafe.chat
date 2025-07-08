import {
  Component,
  For,
  Show,
  onCleanup,
  onMount,
  createSignal,
  Setter,
} from "solid-js";
import { FS_URL } from "../../constants";
import { UserStatus, StatusIndicator } from "./StatusIndicator";
import { Avatar } from "./Avatar";
import { Portal } from "solid-js/web";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useSettings } from "../../lib/providers/settings/SettingsProvider";
import { useToast } from "../common/Toast";
import UserSettings from "../settings/UserSettings";
import CustomStatusModal from "../modals/SetCustomStatusModal";
import { useTransContext } from "@mbarzda/solid-i18next";

interface Props {
  isOpen: boolean;
  onClose: (event?: Event) => void;
  triggerRef?: HTMLElement;
  customStatus: string;
  setCustomStatus: Setter<string>;
  customEmoji: string;
  setCustomEmoji: Setter<string>;
}

const statusOptions = [
  { status: "online" },
  { status: "idle" },
  { status: "dnd" },
  { status: "offline" },
] as const;

const ClientUserPopup: Component<Props> = (props) => {
  const { user, updateStatus } = useAuth();
  const { state, setActiveSection, setIsOpen } = useSettings();
  const [showStatusMenu, setShowStatusMenu] = createSignal(false);
  const [showCustomStatusModal, setShowCustomStatusModal] = createSignal(false);
  const { showToast } = useToast();
  const [t] = useTransContext();
  let closeTimeout: number;
  let popupRef: HTMLDivElement | undefined;
  let statusButtonRef: HTMLDivElement | undefined;
  let statusMenuRef: HTMLDivElement | undefined;

  const handleMouseEnter = () => {
    window.clearTimeout(closeTimeout);
    setShowStatusMenu(true);
  };

  const handleMouseLeave = () => {
    closeTimeout = window.setTimeout(() => {
      setShowStatusMenu(false);
    }, 100);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
      setShowStatusMenu(false);
    }
  };

  const getValidStatus = (status: string | undefined): UserStatus => {
    if (
      status === "online" ||
      status === "idle" ||
      status === "dnd" ||
      status === "offline"
    ) {
      return status;
    }
    return "offline";
  };

  const handleStatusClick = async (status: string) => {
    try {
      const success = await updateStatus(
        status,
        user()?.presence?.custom_status,
      );
      if (success) {
        setShowStatusMenu(false);
      } else {
        showToast("Error updating status", "error");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Error updating status", "error");
    }
  };

  // Handle clicking outside to close
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    const clickedTrigger = props.triggerRef?.contains(target)
    const clickedPopup = popupRef?.contains(target);

    if (!clickedTrigger && !clickedPopup) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    window.removeEventListener("keydown", handleKeyDown);
    window.clearTimeout(closeTimeout);
  });

  // Calculate position relative to trigger element
  const getPopupStyle = () => {
    if (!props.triggerRef) return {};

    const rect = props.triggerRef.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    // Position above if there's more space above, otherwise below
    const verticalPosition =
      spaceAbove > spaceBelow
        ? {
            bottom: `${window.innerHeight - rect.top + 10}px`,
            maxHeight: `${spaceAbove - 20}px`,
          }
        : {
            top: `${rect.bottom + 10}px`,
            maxHeight: `${spaceBelow - 20}px`,
          };

    return {
      left: `${Math.max(10, rect.left) - 35}px`,
      ...verticalPosition,
    };
  };

  // New StatusDot component for the status menu
  const StatusDot: Component<{ status: UserStatus }> = (props) => {
    const getStatusColor = () => {
      switch (props.status) {
        case "online":
          return "bg-[#43B581]";
        case "idle":
          return "bg-[#FAA81A]";
        case "dnd":
          return "bg-[#F04747]";
        case "offline":
          return "bg-[#747F8D]";
      }
    };

    return <div class={`w-3 h-3 rounded-full ${getStatusColor()}`} />;
  };

  return (
    <div class="relative">
      <Show when={props.isOpen && props.triggerRef}>
        <Portal>
          <div
            class="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={props.onClose}
          />
          <div
            ref={popupRef}
            class="fixed z-50 bg-background2 rounded-lg shadow-lg w-[300px] overflow-hidden animate-fade-in"
            style={getPopupStyle()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Banner & Avatar */}
            <div class="h-[100px] relative">
              <Show
                when={user()?.banner}
                fallback={<div class="h-full w-full bg-primary" />}
              >
                <img
                  src={`${FS_URL}/banners/${user()?.id}/${user()?.banner}`}
                  alt="User banner"
                  class="w-full h-full object-cover"
                />
              </Show>
              <div class="absolute -bottom-6 left-2">
                <div class="relative w-[80px] h-[80px]">
                  <Avatar
                    userId={user()?.id!}
                    avatar={user()?.avatar}
                    alt="User avatar"
                    class="object-cover border-4 border-background2"
                    size="xl"
                  />
                  <div class="absolute bottom-0.5 right-0.5">
                    <StatusIndicator
                      status={getValidStatus(user()?.presence?.status)}
                      class="w-7 h-7 border-[6px] border-background2 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Badge Section */}
            <div class="absolute top-[113px] right-3">
              <div class="inline-flex items-center gap-1.5 bg-[#111214] px-1.5 py-1 rounded-md">
                <button class="w-5 h-5 rounded-[4px] flex items-center justify-center group cursor-pointer hover:bg-[#2b2d31] transition-colors">
                  <svg class="w-3.5 h-3.5 text-[#b5bac1] group-hover:text-[#dbdee1]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L8.5 8.5 2 9.8l5 4.9L5.8 22 12 18.5 18.2 22 17 14.7l5-4.9-6.5-1.3z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* User Info */}
            <div class="mt-4 p-4">
              <div class="font-semibold text-lg">{user()?.display_name}</div>
              <div class="text-sm text-text-secondary">
                {user()?.username}#
                {String(user()?.discriminator).padStart(4, "0")}
              </div>

              {/* Edit Profile Button */}
              <div class="w-full pt-4">
                <div
                  class="w-full flex items-center gap-2 px-3 py-2 bg-surface bg-opacity-5 hover:bg-primary hover:bg-opacity-10 rounded-md transition-colors text-left relative group cursor-pointer"
                  onClick={() => {
                    setShowStatusMenu(false);
                    props.onClose();
                    setIsOpen(true);
                    setActiveSection("profile");
                  }}
                >
                  <div class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-text-secondary group-hover:text-text-primary"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                    <span class="text-sm">{t("profile.editProfile")}</span>
                  </div>
                </div>
              </div>

              {/* Status Button - Single Instance */}
              <div class="w-full">
                <div
                  ref={statusButtonRef}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  class="w-full flex items-center gap-2 px-3 py-2 bg-surface bg-opacity-5 hover:bg-primary hover:bg-opacity-10 rounded-md transition-colors text-left relative group mt-2 cursor-pointer"
                  onClick={() => setShowStatusMenu(true)}
                >
                  <div class="flex items-center gap-2">
                    <div
                      class={`w-4 h-4 rounded-full ${
                        getValidStatus(user()?.presence?.status) === "online"
                          ? "bg-green-500"
                          : getValidStatus(user()?.presence?.status) === "idle"
                            ? "bg-yellow-500"
                            : getValidStatus(user()?.presence?.status) === "dnd"
                              ? "bg-red-500"
                              : "bg-gray-500"
                      }`}
                    />
                    <span class="text-sm">
                      {t(`status.${getValidStatus(user()?.presence?.status)}`)}
                    </span>
                  </div>
                  <div class="ml-auto">
                    <svg
                      class="w-4 h-4 text-text-secondary group-hover:text-text-primary"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Custom Status Button */}
              <div class="w-full">
                <div
                  class="w-full flex items-center gap-2 px-3 py-2 bg-surface bg-opacity-5 hover:bg-primary hover:bg-opacity-10 rounded-md transition-colors text-left relative group mt-2 cursor-pointer"
                  onClick={() => {
                    setShowCustomStatusModal(true);
                    setShowStatusMenu(false);
                    props.onClose();
                  }}
                >
                  <div class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-text-secondary group-hover:text-text-primary"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20 12a8 8 0 01-8 8l-4 3v-3H6a4 4 0 01-4-4V8a4 4 0 014-4h10a4 4 0 014 4v4z" />
                    </svg>
                    <span class="text-sm">{t("status.customStatus")}</span>
                  </div>
                </div>
              </div>

              {/* Copy ID Button */}
              <div class="w-full">
                <div
                  class="w-full flex items-center gap-2 px-3 py-2 bg-surface bg-opacity-5 hover:bg-primary hover:bg-opacity-10 rounded-md transition-colors text-left relative group mt-2 cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(user()?.id!);
                    showToast(t("profile.idCopied"), "success");
                  }}
                >
                  <div class="flex items-center gap-2">
                    <div class="w-4 h-4 border-2 border-text-secondary group-hover:border-text-primary rounded text-[8px] font-bold flex items-center justify-center text-text-secondary group-hover:text-text-primary">
                      ID
                    </div>
                    <span class="text-sm">{t("profile.copyId")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Menu */}
            <Show when={showStatusMenu() && props.isOpen}>
              {/* Invisible hover bridge between button and menu */}
              <div
                class="fixed z-[59]"
                style={{
                  left: `${statusButtonRef?.getBoundingClientRect().right!}px`,
                  top: `${statusButtonRef?.getBoundingClientRect().top!}px`,
                  width: "20px",
                  height: `${statusButtonRef?.offsetHeight}px`,
                }}
              />
              <div
                ref={statusMenuRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                class="fixed z-[60] bg-background2 rounded-lg shadow-lg w-[180px] overflow-hidden animate-fade-in"
                style={{
                  left: `${
                    statusButtonRef?.getBoundingClientRect().right! + 15
                  }px`,
                  top: (() => {
                    const buttonTop =
                      statusButtonRef?.getBoundingClientRect().top! +
                      (statusButtonRef?.offsetHeight || 0) / 2 -
                      15;
                    return `${buttonTop}px`;
                  })(),
                }}
              >
                <div class="p-2 space-y-1">
                  <div class="flex flex-col gap-1">
                    <For each={statusOptions}>
                      {(option) => (
                        <button
                          class="flex items-center gap-2 px-2 py-1.5 hover:bg-surface rounded-md text-text-primary"
                          onClick={() => handleStatusClick(option.status)}
                        >
                          <StatusDot status={option.status} />
                          <span>{t(`status.${option.status}`)}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </Portal>
      </Show>
      <Portal>
        <CustomStatusModal
          isOpen={showCustomStatusModal()}
          onClose={() => setShowCustomStatusModal(false)}
        />
      </Portal>
      <UserSettings isOpen={state.isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
};

export default ClientUserPopup;
