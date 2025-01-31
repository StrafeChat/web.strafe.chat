import { Component, createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import Modal from "../modals/Modal";
import SwipeableView from "../shared/SwipeableView";
import AccountSettings from "./pages/AccountSettings";
import ProfileSettings from "./pages/ProfileSettings";
import AppearanceSettings from "./pages/AppearanceSettings";
import DefaultSettings from "./pages/DefaultSettings";
import LanguageSettings from "./pages/LanguageSettings";
import { useTransContext } from "@mbarzda/solid-i18next";

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserSettings: Component<UserSettingsProps> = (props) => {
  const { isMobile, logout } = useAuth();
  const [t] = useTransContext();
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [activeSection, setActiveSection] = createSignal("account");

  const sections = [
    "account",
    "profile",
    "privacy",
    "appearance",
    "accessibility",
    "language",
    "voice",
    "text",
    "notifications",
    "keybinds",
  ];

  const handleSwipeLeft = () => {
    const currentIndex = sections.indexOf(activeSection());
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    const currentIndex = sections.indexOf(activeSection());
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1]);
    }
  };

  const renderContent = () => {
    switch (activeSection()) {
      case "account":
        return <AccountSettings />;
      case "profile":
        return <ProfileSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "language":
        return <LanguageSettings />;
      default:
        return <DefaultSettings title={activeSection()} />;
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} type="full">
      <div
        class={`h-screen w-full flex ${
          (!isMobile() && props.isOpen) || (isMobile() && isSidebarOpen())
            ? ""
            : "bg-background2"
        }`}
      >
        <Show
          when={
            (!isMobile() && props.isOpen) || (isMobile() && isSidebarOpen())
          }
        >
          <div class="w-1/2 bg-background1"></div>
          <div class="w-1/2 bg-background2"></div>
        </Show>
        <div class="absolute inset-0 flex justify-center">
          <div class="flex w-full max-w-[1320px] px-4 md:px-6">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen())}
              class="md:hidden fixed top-4 left-4 z-50 p-2 text-text-primary hover:bg-surface rounded-md"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class={`w-6 h-6 transition-transform duration-300 ${
                  isSidebarOpen() ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Sidebar */}
            <Show
              when={
                (!isMobile() && props.isOpen) || (isMobile() && isSidebarOpen())
              }
            >
              <div
                class={`fixed md:relative w-[280px] md:w-[218px] bg-background1 h-full flex flex-col z-40 transition-transform ${
                  !isSidebarOpen() && isMobile()
                    ? "-translate-x-full"
                    : "translate-x-0"
                }`}
              >
                <div class="flex-1 py-[20px] px-[6px] overflow-y-auto">
                  {/* User Settings Section */}
                  <div class="px-2 mt-16 mb-2">
                    <h3 class="px-[10px] mb-1 text-xs font-semibold text-text-secondary uppercase">
                      {t("settings.sections.user")}
                    </h3>
                    <div class="space-y-[2px]">
                      <button
                        onClick={() => {
                          setActiveSection("account");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "account" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.account")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("profile");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "profile" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.profile")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("privacy");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "privacy" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.privacy")}
                      </button>
                    </div>
                  </div>

                  {/* Separator Line */}
                  <div class="mx-2 mb-4 border-t border-border"></div>

                  {/* App Settings Section */}
                  <div class="px-2">
                    <h3 class="px-[10px] mb-1 text-xs font-semibold text-text-secondary uppercase">
                      {t("settings.sections.app")}
                    </h3>
                    <div class="space-y-[2px] mb-2">
                      <button
                        onClick={() => {
                          setActiveSection("appearance");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "appearance" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.appearance")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("accessibility");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "accessibility"
                            ? "bg-surface"
                            : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.accessibility")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("language");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "language" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.language")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("voice");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "voice" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.voice")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("text");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "text" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.text")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("notifications");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "notifications"
                            ? "bg-surface"
                            : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.notifications")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("keybinds");
                          isMobile() && setIsSidebarOpen(false);
                        }}
                        class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                          activeSection() === "keybinds" ? "bg-surface" : ""
                        } text-text-primary`}
                      >
                        {t("settings.sections.keybinds")}
                      </button>
                    </div>

                    <div class="mx-2 mb-2 border-t border-border"></div>

                    <div class="space-y-[2px]">
                      <button
                        onClick={() => {
                          logout();
                        }}
                        class="w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface text-red-500 hover:text-red-400"
                      >
                        {t("settings.sections.logout")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Show>

            {/* Main content area */}
            <div class="flex-1 bg-background2 h-full flex flex-col ml-0 relative">
              {/* Top bar with close button */}
              <div class="h-[60px] flex items-center justify-end px-5 bg-background2">
                <div class="md:absolute md:right-[-35px] md:top-20 flex flex-col items-center fixed right-4 top-4 mr-[25px]">
                  <button
                    onClick={props.onClose}
                    class="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-background transition-colors duration-200 border z-50 cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-text-secondary w-5 h-5"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <span class="text-text-secondary text-xs mt-1 hidden md:block">
                    ESC
                  </span>
                </div>
              </div>

              {/* Content */}
              <SwipeableView
                class="flex-1 min-h-0"
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
              >
                <div class="mx-auto py-[20px] px-4 md:px-10">
                  {renderContent()}
                </div>
              </SwipeableView>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default UserSettings;
