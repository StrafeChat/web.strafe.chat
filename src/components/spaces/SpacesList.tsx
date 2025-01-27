import { Component, createMemo, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { Tooltip } from "../common/Tooltip";

const SpacesList: Component = () => {
  const navigate = useNavigate();
  const { relationshipRequests, user } = useAuth();

  const pendingCount = createMemo(() => {
    const currentUser = user();
    const currentRelationships = relationshipRequests();
    if (!currentUser?.id || !currentRelationships) return 0;

    return currentRelationships.filter(
      (rel) => rel.recipient_id === currentUser.id
    ).length;
  });

  return (
    <div class="flex flex-col items-center h-full py-3 gap-2 bg-[var(--background)]">
      {/* Home button */}
      <Tooltip content={"Home"} position="right">
        <button
          class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all group relative"
          onClick={() => navigate("/")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <Show when={pendingCount() > 0}>
            <div class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-[20px] h-[20px] rounded-full grid place-items-center border-[2.5px] border-[var(--background)]">
              {pendingCount()}
            </div>
          </Show>
        </button>
      </Tooltip>

      {/* Separator */}
      <div class="w-8 h-0.5 rounded-full bg-border" />

      {/* Flex spacer to push buttons to bottom */}
      <div class="flex-1" />

      {/* Separator */}
      <div class="w-8 h-0.5 rounded-full bg-border" />

      {/* Bottom buttons container */}
      <div class="flex flex-col gap-2">
        <Tooltip content={"Add a Space"} position="right">
          <button class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </Tooltip>

        <Tooltip content={"Discover"} position="right">
          <button class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default SpacesList;
