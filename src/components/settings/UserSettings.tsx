import { Component, createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useSettings } from "../../lib/providers/settings/SettingsProvider";
import { APP_VERSION } from "../../constants";
import Modal from "../modals/Modal";
import SwipeableView from "../shared/SwipeableView";
import AccountSettings from "./user/AccountSettings";
import ProfileSettings from "./user/ProfileSettings";
import AppearanceSettings from "./user/AppearanceSettings";
import DefaultSettings from "./user/DefaultSettings";
import LanguageSettings from "./user/LanguageSettings";
import SessionsSettings from "./user/SessionsSettings";
import PrivacySettings from "./user/PrivacySettings";
import BotsSettings from "./user/BotsSettings";
import OAuth2Settings from "./user/OAuth2Settings";
import { ToastProvider } from "../common/Toast";

// Import icons
import User from "../shared/icons/User";
import Friends from "../shared/icons/Friends";
import Monitor from "../shared/icons/Monitor";
import Shield from "../shared/icons/Shield";
import Palette from "../shared/icons/Palette";
import Globe from "../shared/icons/Globe";
import Keyboard from "../shared/icons/Keyboard";
import Bell from "../shared/icons/Bell";
import Robot from "../shared/icons/Robot";
import Key from "../shared/icons/Key";
import { VoiceSettings } from "./pages/VoiceSettings";
import { PhoneRinging } from "../shared/icons/PhoneRinging";

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserSettings: Component<UserSettingsProps> = (props) => {
  const { isMobile, logout } = useAuth();
  const [t] = useTransContext();
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const { state, setActiveSection } = useSettings();

  const sections = [
    "account",
    "profile",
    "sessions",
    "privacy",
    "notifications",
    "appearance",
    "language",
    "keybinds",
  ];

  const handleSwipeLeft = () => {
    const currentIndex = sections.indexOf(state.activeSection);
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    const currentIndex = sections.indexOf(state.activeSection);
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1]);
    }
  };

  const renderContent = () => {
    switch (state.activeSection) {
      case "account":
        return <AccountSettings />;
      case "profile":
        return <ProfileSettings />;
      case "sessions":
        return <SessionsSettings />;
      case "privacy":
        return <PrivacySettings />; 	
      case "appearance":
        return <AppearanceSettings />;
      case "language":
        return <LanguageSettings />;
      case "bots":
        return <BotsSettings />;
      case "oauth2":
        return <OAuth2Settings />;
			case "voice":
				return <VoiceSettings />;
      default:
        return <DefaultSettings title={state.activeSection} />;
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} type="full">
      <ToastProvider usePortal={false}>
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
                  (!isMobile() && props.isOpen) ||
                  (isMobile() && isSidebarOpen())
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
                            state.activeSection === "account"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <User />
                          {t("settings.sections.account")}
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("profile");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "profile"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Friends />
                          {t("settings.sections.profile")}
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("sessions");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "sessions"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Monitor />
                          {t("settings.sections.sessions")}
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("privacy");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "privacy"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Shield />
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
                            state.activeSection === "appearance"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Palette />
                          {t("settings.sections.appearance")}
                        </button>
												<button
													onClick={() => {
														setActiveSection("voice");
														isMobile() && setIsSidebarOpen(false);
													}}
													class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${state.activeSection === "voice"
															? "bg-surface"
															: ""
														} text-text-primary flex items-center gap-3`}
												>
													<PhoneRinging />
													Voice and Video
												</button>
                        <button
                          onClick={() => {
                            setActiveSection("language");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "language"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Globe />
                          {t("settings.sections.language")}
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("keybinds");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "keybinds"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Keyboard />
                          {t("settings.sections.keybinds")}
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("notifications");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "notifications"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Bell />
                          {t("settings.sections.notifications")}
                        </button>
                      </div>

                      <div class="mx-2 mb-4 border-t border-border"></div>

                      {/* Developers Section */}
                      <div class="space-y-[2px] mb-2">
                        <h3 class="px-[10px] mb-1 text-xs font-semibold text-text-secondary uppercase">
                          {t("settings.sections.developers")}
                        </h3>
                        <button
                          onClick={() => {
                            setActiveSection("bots");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "bots"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Robot />
                          {t("settings.sections.bots")}
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("oauth2");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "oauth2"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Key />
                          {t("settings.sections.oauth2")}
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
                        <div class="px-[10px] py-[6px] text-xs text-text-secondary flex flex-col">
                          <span>{t("settings.version")}: v{APP_VERSION}</span>
                          <a 
                            href="https://github.com/StrafeChat/web.strafe.chat" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="hover:underline"
                          >
                            StrafeChat/web.strafe.chat
                          </a>
                          <a 
                            href="https://github.com/StrafeChat/web.strafe.chat/issues/new" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="hover:underline flex items-center mt-1"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              class="mr-1"
                            >
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            {t("settings.report_issue")}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

              {/* Main content area */}
              <div class="flex-1 bg-background2 h-full flex flex-col ml-0 relative">
                {/* Top bar with close button */}
                <div class="h-[60px] flex items-center justify-end px-5 bg-background2">
                  <div class="md:absolute md:right-[-35px] md:top-20 flex flex-col items-center fixed right-4 top-4 z-50">
                    <button
                      onClick={props.onClose}
                      class="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-background transition-colors duration-200 border cursor-pointer"
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
                  class="flex-1 min-h-0 flex flex-col"
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                >
                  <div class="py-[20px] px-4 md:px-10 h-full overflow-y-auto pr-[50px] md:pr-[60px] flex-1">
                    {renderContent()}
                  </div>
                </SwipeableView>
              </div>
            </div>
          </div>
        </div>
      </ToastProvider>
    </Modal>
  );
};

export default UserSettings;
