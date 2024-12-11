import { Component, createSignal, onCleanup, onMount } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { Motion } from "solid-motionone";
import { useModal } from "../../../lib/providers/modal/ModalProvider";
import { AddFriendModal } from "../../modals/AddFriendModal";
import { OnlineTab } from "./tabs/OnlineTab";
import { AllTab } from "./tabs/AllTab";
import { PendingTab } from "./tabs/PendingTab";
import { BlockedTab } from "./tabs/BlockedTab";

type TabType = "online" | "all" | "pending" | "blocked";

export const Friends: Component = () => {
  const [t] = useTransContext();
  useModal();
  const [activeTab, setActiveTab] = createSignal<TabType>("online");
  const [showAddFriend, setShowAddFriend] = createSignal(false);
  const tabRefs: Record<TabType, HTMLDivElement | null> = {
    online: null,
    all: null,
    pending: null,
    blocked: null,
  };
  const [tabSizes, setTabSizes] = createSignal<
    Record<TabType, { width: number; offset: number }>
  >({
    online: { width: 0, offset: 0 },
    all: { width: 0, offset: 0 },
    pending: { width: 0, offset: 0 },
    blocked: { width: 0, offset: 0 },
  });

  const updateTabSizes = () => {
    requestAnimationFrame(() => {
      setTabSizes(
        Object.keys(tabRefs).reduce((sizes, tab) => {
          const ref = tabRefs[tab as TabType];
          if (ref) {
            const parent = ref.parentElement;
            if (!parent) return sizes;

            const width = ref.offsetWidth;
            const offset = ref.offsetLeft;

            sizes[tab as TabType] = {
              width,
              offset,
            };
          }
          return sizes;
        }, {} as Record<TabType, { width: number; offset: number }>)
      );
    });
  };

  onMount(() => {
    updateTabSizes();
    window.addEventListener("resize", updateTabSizes);
    onCleanup(() => window.removeEventListener("resize", updateTabSizes));
  });

  const tabOrder: TabType[] = ["online", "all", "pending", "blocked"];

  const handleTabChange = (tab: TabType) => setActiveTab(tab);

  return (
    <div class="h-full w-full bg-background2">
      <div class="flex flex-col h-full">
        {/* Header Section */}
        <div class="border-b border-border">
          <div class="p-2">
            <div class="flex justify-between items-center px-3 py-1.5">
              <div class="flex gap-4 items-center">
                <div class="flex gap-2 items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-6 h-6 text-text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <h2 class="text-xl font-semibold text-text-primary">
                    {t("friends.title")}
                  </h2>
                </div>

                <div class="hidden md:block">
                  <div class="h-6 w-[2px] bg-border mx-1"></div>
                </div>

                {/* Desktop Tabs */}
                <div class="hidden md:flex gap-2 relative bg-background-secondary rounded p-0.5">
                  <div
                    class="absolute h-[26px] bg-accent rounded"
                    style={{
                      width: `${tabSizes()[activeTab()]?.width}px`,
                      transform: `translateX(${
                        tabSizes()[activeTab()]?.offset
                      }px)`,
                      transition:
                        "transform 0.3s ease-in-out, width 0.3s ease-in-out",
                    }}
                  />
                  {tabOrder.map((tab) => (
                    <Motion
                      ref={(el) => {
                        if (el) {
                          tabRefs[tab] = el;
                          requestAnimationFrame(() => updateTabSizes());
                        }
                      }}
                      initial={{ scale: 1 }}
                      class={`px-3 py-0.5 rounded z-10 cursor-pointer transition-colors relative h-[26px] flex items-center whitespace-nowrap ${
                        activeTab() === tab
                          ? "text-white"
                          : "hover:bg-surface text-text-secondary hover:text-text-primary"
                      }`}
                      onClick={() => handleTabChange(tab)}
                      press={{ scale: 0.95 }}
                    >
                      {t(`friends.tabs.${tab}`)}
                    </Motion>
                  ))}
                </div>
              </div>

              {/* Add Friend Button */}
              <div class="flex items-center">
                {/* Desktop Button */}
                <button
                  onClick={() => {
                    console.log("Button clicked, opening drawer/modal");
                    setShowAddFriend(true);
                  }}
                  class="hidden md:flex px-3 py-1.5 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors items-center right-0 gap-1.5 shadow-lg hover:shadow-xl text-sm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                  {t("friends.addFriend")}
                </button>

                {/* Mobile Icon Button */}
                <button
                  onClick={() => {
                    console.log("Button clicked, opening drawer/modal");
                    setShowAddFriend(true);
                  }}
                  class="md:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface transition-colors"
                  title={t("friends.addFriend")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5 text-text-secondary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M20 8v6m3-3h-6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div class="flex md:hidden justify-center mt-2">
          <div class="relative">
            <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              <div
                class="absolute h-[26px] bg-accent rounded"
                style={{
                  width: `${tabSizes()[activeTab()]?.width}px`,
                  transform: `translateX(${tabSizes()[activeTab()]?.offset}px)`,
                  transition:
                    "transform 0.3s ease-in-out, width 0.3s ease-in-out",
                }}
              />
              {tabOrder.map((tab) => (
                <Motion
                  ref={(el) => {
                    if (el) {
                      tabRefs[tab] = el;
                      requestAnimationFrame(() => updateTabSizes());
                    }
                  }}
                  initial={{ scale: 1 }}
                  class={`px-3 py-0.5 rounded z-10 cursor-pointer transition-colors relative h-[26px] flex items-center whitespace-nowrap ${
                    activeTab() === tab
                      ? "text-white"
                      : "hover:bg-surface text-text-secondary hover:text-text-primary"
                  }`}
                  onClick={() => handleTabChange(tab)}
                  press={{ scale: 0.95 }}
                >
                  {t(`friends.tabs.${tab}`)}
                </Motion>
              ))}
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          {activeTab() === "online" && <OnlineTab />}
          {activeTab() === "all" && <AllTab />}
          {activeTab() === "pending" && <PendingTab />}
          {activeTab() === "blocked" && <BlockedTab />}
        </div>

        <AddFriendModal
          isOpen={showAddFriend()}
          onClose={() => {
            console.log("Closing modal");
            setShowAddFriend(false);
          }}
        />
      </div>
    </div>
  );
};
