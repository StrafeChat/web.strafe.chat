import {
  Component,
  createMemo,
  createEffect,
  For,
  Show,
  createSignal,
} from "solid-js";
import { useAuth } from "../../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";
import { Tooltip } from "../../../common/Tooltip";
import { FriendSearch } from "../FriendSearch";
import { BASE_URL, FS_URL } from "../../../../constants";

export const PendingTab: Component = () => {
  const { relationshipRequests, user, setRelationshipRequests } = useAuth();
  const cache = useCache();
  const loading = createMemo(() => !user()?.id || !relationshipRequests());
  const [searchQuery, setSearchQuery] = createSignal("");

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
      id: userData()?.id,
      name: `${userData()?.display_name || userData()?.username}`,
      avatar: userData()?.avatar,
    };
  };

  const filteredRequests = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const allRequests = [...incoming(), ...outgoing()];

    if (!query) return allRequests;

    return allRequests.filter((request) => {
      const isIncoming = request.recipient_id === user()?.id;
      const targetId = isIncoming ? request.sender_id : request.recipient_id;
      const person = getUserDisplay(targetId);
      const userData = cache.getUser(targetId);

      return (
        person.name.toLowerCase().includes(query) ||
        targetId.toLowerCase().includes(query) ||
        userData?.username?.toLowerCase().includes(query) ||
        userData?.display_name?.toLowerCase().includes(query)
      );
    });
  });

  const handleAccept = async (request: Relationship) => {
    try {
      const response = await fetch(
        `${BASE_URL}/users/@me/relationships/${request.id}`,
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
        `${BASE_URL}/users/@me/relationships/${request.id}`,
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
        `${BASE_URL}/users/@me/relationships/${request.id}`,
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
    <div class="p-4 px-7 flex flex-col h-full overflow-hidden">
      <FriendSearch onSearch={setSearchQuery} />
      <Show
        when={!loading() && filteredRequests().length > 0}
        fallback={
          <div class="text-text-secondary text-center p-4">
            {searchQuery()
              ? "No pending requests found matching your search."
              : !loading()
              ? "No pending friend requests"
              : "Loading friend requests..."}
          </div>
        }
      >
        <h3 class="text-text-primary font-medium text-lg px-2 pb-4 mt-2">
          Pending - {filteredRequests().length}
        </h3>
        <div class="overflow-y-auto flex-1 min-h-0">
          <For each={filteredRequests()}>
            {(request) => {
              const isIncoming = request.recipient_id === user()?.id;
              const person = getUserDisplay(
                isIncoming ? request.sender_id : request.recipient_id
              );
              return (
                <div class="flex flex-col bg-background-secondary p-2 pb-3.5 border-t-2 border-t-border hover:bg-border hover:rounded-lg hover:cursor-pointer">
                  <div class="flex items-center gap-3">
                    {person.avatar ? (
                      <div class="relative w-10 h-10">
                        <img
                          src={`${FS_URL}/avatars/${person.id}/${person.avatar}`}
                          alt="avatar"
                          class="w-full h-full rounded-full object-cover"
                          style={{ "aspect-ratio": "1/1" }}
                        />
                      </div>
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
                    <div class="flex">
                      {isIncoming ? (
                        <>
                          <Tooltip content={"Accept"} position="top">
                            <button
                              onClick={() => handleAccept(request)}
                              class="p-2 border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white rounded-full transition-colors"
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
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                          </Tooltip>

                          <Tooltip content={"Deny"} position="top">
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
                        <Tooltip content={"Cancel"} position="top">
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
    </div>
  );
};
