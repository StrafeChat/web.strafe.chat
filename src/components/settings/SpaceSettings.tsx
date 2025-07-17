import { Component, createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
// import { useTransContext } from "@mbarzda/solid-i18next";
import { usePermissions } from "../../lib/hooks/usePermissions";
import { useSettings } from "../../lib/providers/settings/SettingsProvider";
// import { Space } from "../../lib/cache/SpaceCache";
import Modal from "../modals/Modal";
import SwipeableView from "../shared/SwipeableView";
import SpaceOverviewSettings from "./space/SpaceOverviewSettings";
import SpaceSecuritySettings from "./space/SpaceSecuritySettings";
import SpaceModerationSettings from "./space/SpaceModerationSettings";
import SpaceRolesSettings from "./space/SpaceRolesSettings";
import SpaceMembersSettings from "./space/SpaceMembersSettings";
import DefaultSettings from "./user/DefaultSettings";
import { ToastProvider } from "../common/Toast";

// Import icons
import Settings from "../shared/icons/Settings";
import Shield from "../shared/icons/Shield";
import User from "../shared/icons/User";
import GroupUsers from "../shared/icons/GroupUsers";
import Users from "../shared/icons/Users";
import Crown from "../shared/icons/Crown";
import Link from "../shared/icons/Link";
import SpaceInvitesSettings from "./space/SpaceInvitesSettings";

interface SpaceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
}

const SpaceSettings: Component<SpaceSettingsProps> = (props) => {
  const { isMobile, user } = useAuth();
  const { getSpace } = useCache();
  const { checkPermission } = usePermissions();
  // const [t] = useTransContext();
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const { state, setActiveSection } = useSettings();

  const space = () => getSpace(props.spaceId);
  const isOwner = () => space()?.owner_id === user()?.id;
  const canManageSpace = () => isOwner() || checkPermission(props.spaceId, "MANAGE_SPACE");

  const sections = [
    "overview",
    "roles",
    "members",
    "moderation",
    "security",
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
    if (!space()) {
      return <div class="text-text-secondary">Space not found</div>;
    }

    switch (state.activeSection) {
      case "overview":
        return <SpaceOverviewSettings space={space()!} />;
      case "roles":
        return <SpaceRolesSettings space={space()!} />;
      case "members":
        return <SpaceMembersSettings space={space()!} />;
      case "invites":
        return <SpaceInvitesSettings space={space()!} />;
      case "moderation":
        return <SpaceModerationSettings space={space()!} />;
      case "security":
        return <SpaceSecuritySettings space={space()!} />;
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
                    {/* Space Header */}
                    <div class="px-2 mt-16 mb-4">
                      <div class="flex items-center gap-3 mb-4">
                        <div class="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          {space()?.name_acronym || space()?.name?.charAt(0) || "S"}
                        </div>
                        <div class="flex-1 min-w-0">
                          <h2 class="text-lg font-semibold text-text-primary truncate">
                            {space()?.name || "Unknown Space"}
                          </h2>
                          <p class="text-xs text-text-secondary">
                            Space Settings
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Separator Line */}
                    <div class="mx-2 mb-4 border-t border-border"></div>

                    {/* Space Settings Section */}
                    <div class="px-2 mb-2">
                      <h3 class="px-[10px] mb-1 text-xs font-semibold text-text-secondary uppercase">
                        Space Settings
                      </h3>
                      <div class="space-y-[2px]">
                        <button
                          onClick={() => {
                            setActiveSection("overview");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "overview"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Settings />
                          Overview
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("roles");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "roles"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Crown />
                          Roles
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("members");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "members"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Users />
                          Members
                        </button>
                          <button
                          onClick={() => {
                            setActiveSection("invites");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "invites"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Link />
                          Invites
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("moderation");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "moderation"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Shield />
                          Moderation
                        </button>
                        <button
                          onClick={() => {
                            setActiveSection("security");
                            isMobile() && setIsSidebarOpen(false);
                          }}
                          class={`w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-surface ${
                            state.activeSection === "security"
                              ? "bg-surface"
                              : ""
                          } text-text-primary flex items-center gap-3`}
                        >
                          <Shield />
                          Security
                        </button>
                      </div>
                    </div>

                    {/* Separator Line */}
                    <div class="mx-2 mb-4 border-t border-border"></div>

                    {/* Danger Zone - Only for owners */}
                    <Show when={isOwner()}>
                      <div class="px-2">
                        <h3 class="px-[10px] mb-1 text-xs font-semibold text-text-secondary uppercase">
                          Danger Zone
                        </h3>
                        <div class="space-y-[2px]">
                          <button class="w-full px-[10px] py-[6px] rounded-[4px] text-left text-base hover:bg-red-500/10 text-red-500 hover:text-red-400">
                            Delete Space
                          </button>
                        </div>
                      </div>
                    </Show>
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

export default SpaceSettings;