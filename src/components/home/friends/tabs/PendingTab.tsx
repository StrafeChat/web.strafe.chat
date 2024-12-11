import { Component, createMemo, createEffect, For, Show } from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";

export const PendingTab: Component = () => {
  const { relationships, user } = useAuth();
  const cache = useCache();
  const loading = createMemo(() => !user()?.id || !relationships());

  createEffect(() => {
    console.log("[PendingTab] Auth state:", {
      hasUser: !!user(),
      userId: user()?.id,
      hasRelationships: !!relationships(),
      relationshipCount: relationships()?.length ?? 0,
    });
  });

  const incoming = createMemo(() => {
    const currentUser = user();
    if (!currentUser?.id) return [];
    const rels =
      relationships()?.filter(
        (r) => r.recipient_id === currentUser.id
      ) ?? [];
    console.log(
      "[PendingTab] Incoming relationships:",
      rels,
      "Current user:",
      currentUser.id
    );
    return rels;
  });

  const outgoing = createMemo(() => {
    const currentUser = user();
    if (!currentUser?.id) {
      console.log("[PendingTab] No current user ID for outgoing");
      return [];
    }
    const allRels = relationships();
    if (!allRels) {
      console.log("[PendingTab] No relationships found");
      return [];
    }

    console.log("[PendingTab] Filtering outgoing relationships:", {
      currentUserId: currentUser.id,
      allRelationships: allRels,
      relationshipIds: allRels.map((r) => ({
        id: r.id,
        sender: r.sender_id,
        recipient: r.recipient_id,
      })),
    });

    const rels = allRels.filter((r) => {
      const isOutgoing = r.sender_id === currentUser.id;
      console.log("[PendingTab] Checking relationship:", {
        relationshipId: r.id,
        senderId: r.sender_id,
        recipientId: r.recipient_id,
        currentUserId: currentUser.id,
        isOutgoing,
      });
      return isOutgoing;
    });

    console.log("[PendingTab] Found outgoing relationships:", rels);
    return rels;
  });

  const getUserDisplay = (userId: string) => {
    const userData = createMemo(() => {
      const cachedUsers = cache.users();
      const user = cachedUsers[userId];
      console.log("[PendingTab] Getting user display for:", userId, user, "All users:", Object.keys(cachedUsers));
      return user;
    });

    if (!userData()) {
      console.warn("[PendingTab] Missing user data for ID:", userId);
      return {
        name: "Unknown User",
        avatar: null,
      };
    }

    return {
      name: `${userData()?.display_name || userData()?.username}`,
      avatar: userData()?.avatar,
    };
  };

  return (
    <div class="p-4 flex flex-col gap-4">
      <div class="text-text-secondary text-sm mb-2">
        Debug: Incoming ({incoming().length}), Outgoing ({outgoing().length}),
        Relationships: {relationships()?.length ?? 0}
      </div>
      <Show when={incoming().length > 0}>
        <div class="flex flex-col gap-2">
          <h3 class="text-text-primary font-medium">
            Incoming Friend Requests
          </h3>
          <For each={incoming()}>
            {(request) => {
              const sender = getUserDisplay(request.sender_id);
              return (
                <div class="flex items-center gap-3 text-text-primary bg-background-secondary rounded-lg p-3">
                  {sender.avatar ? (
                    <img
                      src={sender.avatar}
                      alt="avatar"
                      class="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div class="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
                      {sender.name.charAt(0)}
                    </div>
                  )}
                  <span class="flex-grow">{sender.name}</span>
                  <div class="flex gap-2">
                    <button class="px-3 py-1 bg-accent text-white rounded hover:bg-accent/80">
                      Accept
                    </button>
                    <button class="px-3 py-1 bg-background-tertiary text-text-primary rounded hover:bg-background-tertiary/80">
                      Decline
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={outgoing().length > 0}>
        <div class="flex flex-col gap-2">
          <h3 class="text-text-primary font-medium">
            Outgoing Friend Requests
          </h3>
          <For each={outgoing()}>
            {(request) => {
              const recipient = getUserDisplay(request.recipient_id);
              return (
                <div class="flex items-center gap-3 text-text-primary bg-background-secondary rounded-lg p-3">
                  {recipient.avatar ? (
                    <img
                      src={recipient.avatar}
                      alt="avatar"
                      class="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div class="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
                      {recipient.name.charAt(0)}
                    </div>
                  )}
                  <span class="flex-grow">{recipient.name}</span>
                  <button class="px-3 py-1 bg-background-tertiary text-text-primary rounded hover:bg-background-tertiary/80">
                    Cancel
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show
        when={!loading() && incoming().length === 0 && outgoing().length === 0}
      >
        <div class="text-text-secondary text-center py-8">
          No pending friend requests
        </div>
      </Show>

      <Show when={loading()}>
        <div class="text-text-secondary text-center py-8">
          Loading friend requests...
        </div>
      </Show>
    </div>
  );
};
