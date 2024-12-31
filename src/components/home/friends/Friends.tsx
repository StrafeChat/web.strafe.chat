import {
  Component,
  createSignal,
  onCleanup,
  onMount,
  createMemo,
  createEffect,
  Show,
} from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { useModal } from "../../../lib/providers/modal/ModalProvider";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { AddFriendModal } from "../../modals/AddFriendModal";
import { OnlineTab } from "./tabs/OnlineTab";
import { AllTab } from "./tabs/AllTab";
import { PendingTab } from "./tabs/PendingTab";
import { BlockedTab } from "./tabs/BlockedTab";
import { Tooltip } from "../../common/Tooltip";

type TabType = "online" | "all" | "pending" | "blocked";

export const Friends: Component = () => {
  const [t] = useTransContext();
  const { relationshipRequests, user } = useAuth();
  useModal();
  const [activeTab, setActiveTab] = createSignal<TabType>("online");
  const [showAddFriend, setShowAddFriend] = createSignal(false);

  const pendingCount = createMemo(() => {
    const currentUser = user();
    const currentRelationships = relationshipRequests();
    if (!currentUser?.id || !currentRelationships) return 0;

    return currentRelationships.filter(
      (rel) => rel.recipient_id === currentUser.id
    ).length;
  });

  const [tabSizes, setTabSizes] = createSignal<
    Record<TabType, { width: number; offset: number }>
  >({
    online: { width: 0, offset: 0 },
    all: { width: 0, offset: 0 },
    pending: { width: 0, offset: 0 },
    blocked: { width: 0, offset: 0 },
  });

  const tabRefs: Record<TabType, HTMLDivElement | null> = {
    online: null,
    all: null,
    pending: null,
    blocked: null,
  };

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

  createEffect(() => {
    pendingCount();
    updateTabSizes();
  });

  const tabOrder: TabType[] = ["online", "all", "pending", "blocked"];

  const handleTabChange = (tab: TabType) => setActiveTab(tab);

  return (
    <div class="h-full w-full bg-background2 select-none">
      <div class="flex flex-col h-full">
        {/*_ Header_ */}
        <div class="p-2 flex flex-col border-b border-border">
          <div class="flex items-center gap-4">
            <h2 class="text-xl px-3 py-2 font-semibold text-text-primary select-none flex items-center gap-2">
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
              {t("friends.title")}
            </h2>

            <div class="hidden md:block">
              <div class="h-6 w-[2px] bg-border mx-1"></div>
            </div>

            {/*_ Desktop Tabs _*/}
            <div class="hidden md:inline-flex gap-2 relative bg-background-secondary rounded">
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
                <div
                  ref={(el) => {
                    if (el) {
                      tabRefs[tab] = el;
                      requestAnimationFrame(() => updateTabSizes());
                    }
                  }}
                  class={`px-2 py-0.5 rounded z-10 cursor-pointer transition-colors relative h-[26px] flex items-center whitespace-nowrap ${
                    activeTab() === tab
                      ? "text-white"
                      : "hover:bg-surface text-text-secondary hover:text-text-primary"
                  }`}
                  onClick={() => handleTabChange(tab)}
                >
                  {t(`friends.tabs.${tab}`)}
                  <Show when={tab === "pending" && pendingCount() > 0}>
                    <div class="ml-1.5 bg-red-500 text-white text-xs w-[20px] h-[20px] rounded-full grid place-items-center">
                      {pendingCount()}
                    </div>
                  </Show>
                </div>
              ))}
            </div>

            {/*_ Add Friend Button _*/}
            <div class="flex items-center ml-auto">
              <Tooltip content={t("friends.addFriend")} position="bottom">
                <button
                  onClick={() => setShowAddFriend(true)}
                  class="hover:bg-accent/80 text-white p-2 rounded flex items-center justify-center transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5"
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
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div class="md:hidden flex justify-center w-full mt-4">
          <div class="flex gap-2 relative">
            {tabOrder.map((tab) => (
              <button
                class={`px-3 py-1 rounded relative flex items-center ${
                  activeTab() === tab
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => handleTabChange(tab)}
              >
                {t(`friends.tabs.${tab}`)}
                <Show when={tab === "pending" && pendingCount() > 0}>
                  <div class="ml-1.5 bg-red-500 text-white text-xs w-[20px] h-[20px] rounded-full grid place-items-center">
                    {pendingCount()}
                  </div>
                </Show>
              </button>
            ))}
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
