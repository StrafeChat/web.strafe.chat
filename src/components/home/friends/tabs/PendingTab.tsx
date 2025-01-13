import { Component, createMemo, createEffect, For, Show } from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { Tooltip } from "../../../common/Tooltip";

export const PendingTab: Component = () => {
  const { relationshipRequests, user, setRelationshipRequests } = useAuth();
  const cache = useCache();
  const loading = createMemo(() => !user()?.id || !relationshipRequests());

  createEffect(() => {
    console.log("[PendingTab] Auth state:", {
      hasUser: !!user(),
      userId: user()?.id,
      hasRelationships: !!relationshipRequests(),
      relationshipCount: relationshipRequests()?.length ?? 0,
    });
  });

  const incoming = createMemo(() => {
    const currentUser = user();
    if (!currentUser?.id) return [];
    const rels =
      relationshipRequests()?.filter(
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
    const allRels = relationshipRequests();
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

  interface Relationship {
    id: string;
    sender_id: string;
    recipient_id: string;
  }

  const getUserDisplay = (userId: string) => {
    const userData = createMemo(() => {
      const cachedUsers = cache.users();
      console.log(
        "[PendingTab] Cached users:",
        cachedUsers,
        "User ID:",
        userId
      );
      const user = cachedUsers[userId];
      console.log(
        "[PendingTab] Getting user display for:",
        userId,
        user,
        "All users:",
        Object.keys(cachedUsers)
      );
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

  const handleAccept = async (request: Relationship) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:443/users/@me/relationships/${request.id}`,
        {
          method: "PUT",
          headers: {
            "X-Session-Token": localStorage.getItem("sc_token") || "",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        console.error("[PendingTab] Failed to accept friend request:", data);
        return;
      }

      // Force a re-render of the relationships
      const currentRelationships = relationshipRequests();
      if (currentRelationships) {
        const updatedRelationships = currentRelationships.filter(
          (r) => r.id !== request.id
        );
        setRelationshipRequests(updatedRelationships);
      }

      console.log("[PendingTab] Successfully accepted friend request");
    } catch (error) {
      console.error("[PendingTab] Error accepting friend request:", error);
    }
  };

  const handleDecline = async (request: Relationship) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:443/users/@me/relationships/${request.id}`,
        {
          method: "DELETE",
          headers: {
            "X-Session-Token": localStorage.getItem("sc_token") || "",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        console.error("[PendingTab] Failed to decline friend request:", data);
        return;
      }

      // Force a re-render of the relationships
      const currentRelationships = relationshipRequests();
      if (currentRelationships) {
        const updatedRelationships = currentRelationships.filter(
          (r) => r.id !== request.id
        );
        setRelationshipRequests(updatedRelationships);
      }

      console.log("[PendingTab] Successfully declined friend request");
    } catch (error) {
      console.error("[PendingTab] Error declining friend request:", error);
    }
  };

  const handleCancel = async (request: Relationship) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:443/users/@me/relationships/${request.id}`,
        {
          method: "DELETE",
          headers: {
            "X-Session-Token": localStorage.getItem("sc_token") || "",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        console.error("[PendingTab] Failed to cancel friend request:", data);
        return;
      }

      // Force a re-render of the relationships
      const currentRelationships = relationshipRequests();
      if (currentRelationships) {
        const updatedRelationships = currentRelationships.filter(
          (r) => r.id !== request.id
        );
        setRelationshipRequests(updatedRelationships);
      }

      console.log("[PendingTab] Successfully cancelled friend request");
    } catch (error) {
      console.error("[PendingTab] Error cancelling friend request:", error);
    }
  };

  return (
    <div class="p-4 flex flex-col gap-4 min-h-0 overflow-y-auto">
      <Show
        when={!loading() && (incoming().length > 0 || outgoing().length > 0)}
      >
        <div class="flex flex-col gap-2">
          <h3 class="text-text-primary font-medium">
            Pending - {incoming().length + outgoing().length}
          </h3>
          <For each={[...incoming(), ...outgoing()]}>
            {(request) => {
              const isIncoming = request.recipient_id === user()?.id;
              const person = getUserDisplay(
                isIncoming ? request.sender_id : request.recipient_id
              );
              console.log(person);
              return (
                <div class="flex flex-col bg-background-secondary rounded-lg p-3">
                  <div class="flex items-center gap-3 text-text-primary">
                    {person.avatar ? (
                      <img
                        src={person.avatar}
                        alt="avatar"
                        class="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div class="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
                        {person.name.charAt(0)}
                      </div>
                    )}
                    <div class="flex flex-col flex-grow">
                      <span>{person.name}</span>
                      <span class="text-text-secondary text-sm">
                        {isIncoming
                          ? "Incoming Friend Request"
                          : "Outgoing Friend Request"}
                      </span>
                    </div>
                    <div class="flex gap-2">
                      {isIncoming ? (
                        <>
                          <Tooltip
                            content={"Accept"}
                            position="top"
                          >
                            <button
                            onClick={() => handleAccept(request)}
                            class="p-2 border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white rounded-full transition-colors">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="w-5 h-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          </Tooltip>

                          <Tooltip
                            content={"Deny"}
                            position="top"
                          >
                          <button
                            onClick={() => handleDecline(request)}
                            class="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded-full transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="w-5 h-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                          </Tooltip>
                        </>
                      ) : (
                        <Tooltip
                            content={"Cancel"}
                            position="top"
                          >
                        <button
                          onClick={() => handleCancel(request)}
                          class="p-2 border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded-full transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-5 h-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
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
