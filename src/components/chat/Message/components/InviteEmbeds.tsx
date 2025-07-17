import { Component, Show, For } from "solid-js";
import { FS_URL } from "../../../../constants";
import { InviteState } from "../types";
import { Users } from "../utils/icons";

interface InviteEmbedsProps {
  inviteStates: InviteState[];
}

export const InviteEmbeds: Component<InviteEmbedsProps> = (props) => {
  return (
    <Show
      when={Array.isArray(props.inviteStates) && props.inviteStates.length > 0}
    >
      <div class="mt-2 space-y-2">
        <For each={props.inviteStates}>
          {(state: InviteState) => (
            <div class="border border-border rounded-lg p-4 bg-surface bg-opacity-20 max-w-md">
              {/* Consistent layout structure for all states */}
              <div class="flex items-center gap-3">
                {/* Icon/Avatar section - always 48x48 */}
                <div class="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Show when={state.loading}>
                    <div class="w-full h-full bg-surface bg-opacity-50 animate-pulse rounded-lg"></div>
                  </Show>
                  <Show when={!state.loading && state.error}>
                    <div class="w-full h-full bg-red-500 bg-opacity-20 flex items-center justify-center rounded-lg">
                      <svg
                        class="w-6 h-6 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                  </Show>
                  <Show when={!state.loading && !state.error && state.info}>
                    <Show
                      when={state.info?.space_icon}
                      fallback={
                        <div class="w-full h-full bg-primary flex items-center justify-center text-text-primary font-bold text-lg rounded-lg">
                          {state.info?.space_name_acronym ||
                            state.info?.space_name?.charAt(0).toUpperCase()}
                        </div>
                      }
                    >
                      <img
                        src={`${FS_URL}/space_icons/${state.info?.space_id}/${state.info?.space_icon}`}
                        alt={state.info?.space_name}
                        class="w-full h-full rounded-lg object-cover"
                      />
                    </Show>
                  </Show>
                </div>

                {/* Content section - always same height */}
                <div class="flex-1 min-w-0 h-16 flex flex-col justify-center">
                  <Show when={state.loading}>
                    <div class="space-y-2">
                      <div class="h-4 bg-surface bg-opacity-50 rounded animate-pulse w-3/4"></div>
                      <div class="h-3 bg-surface bg-opacity-50 rounded animate-pulse w-1/2"></div>
                      <div class="h-3 bg-surface bg-opacity-50 rounded animate-pulse w-1/3"></div>
                    </div>
                  </Show>
                  <Show when={!state.loading && state.error}>
                    <div class="space-y-1">
                      <h4 class="font-semibold text-red-500 h-4 leading-4">
                        Invalid Invite
                      </h4>
                      <p class="text-sm text-text-secondary h-3 leading-3">
                        This invite link is invalid or has expired
                      </p>
                      <p class="text-sm text-text-secondary h-3 leading-3">
                        Code: {state.code}
                      </p>
                    </div>
                  </Show>
                  <Show when={!state.loading && !state.error && state.info}>
                    <div class="space-y-1">
                      <h4 class="font-semibold text-text-primary truncate h-4 leading-4">
                        {state.info?.space_name}
                      </h4>
                      <p class="text-sm text-text-secondary truncate h-3 leading-3">
                        Invited by{" "}
                        {state.info?.inviter_display_name ||
                          state.info?.inviter_username}
                      </p>
                      <p class="text-sm text-text-secondary flex items-center gap-1 h-3 leading-3">
                        <Users class="w-4 h-4" />
                        {state.info?.member_count} member
                        {state.info?.member_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Button section - always same height */}
              <div class="mt-3">
                <Show when={state.loading}>
                  <div class="h-9 bg-surface bg-opacity-50 rounded-md animate-pulse w-full"></div>
                </Show>
                <Show when={!state.loading && state.error}>
                  <button
                    disabled
                    class="w-full bg-red-500 bg-opacity-20 text-red-500 pb-0.5 px-4 rounded-md cursor-not-allowed font-medium h-9"
                  >
                    Invite Expired
                  </button>
                </Show>
                <Show when={!state.loading && !state.error && state.info}>
                  <button
                    onClick={() =>
                      (window.location.href = `/invite/${state.info?.code}`)
                    }
                    class="w-full bg-primary text-white pb-0.5 px-4 rounded-md hover:bg-primary-dark transition-colors font-medium h-9"
                  >
                    Join Space
                  </button>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};
