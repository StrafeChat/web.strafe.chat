import { RelationshipPayload } from "../../../types/relationships";
import { BASE_URL } from "../../../constants";

export const handleRelationshipUpdate = async (
  payload: RelationshipPayload,
  cache: any,
  setRelationshipRequests: (updater: (prev: any[]) => any[]) => void,
  setRelationships: (updater: (prev: string[]) => string[]) => void,
  currentUserId: string,
) => {
  console.log("[RelationshipUpdate] Processing payload:", {
    payload,
    currentCache: cache.users(),
  });

  const usersToFetch = [payload.sender_id, payload.recipient_id].filter(
    (userId) => !cache.getUser(userId),
  );

  for (const userId of usersToFetch) {
    console.log("[RelationshipUpdate] Fetching user data for:", userId);
    try {
      const response = await fetch(`${BASE_URL}/users/${userId}`, {
        headers: {
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const userData = await response.json();
      console.log("[RelationshipUpdate] Received user data:", userData);

      cache.setUser({
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        display_name: userData.display_name || userData.username,
        avatar: userData.avatar,
        banner: userData.banner,
        presence: {
          status: userData.presence.status,
          custom_status: userData.presence.custom_status,
        },
      });
    } catch (error) {
      console.error("[RelationshipUpdate] Failed to fetch user data:", error);
    }
  }

  setRelationshipRequests((prev) => {
    console.log("[RelationshipUpdate] Current relationship requests:", prev);
    const newRelationships = [...prev];

    switch (payload.type) {
      case "relationshipCreate":
        // Add request for both sender and recipient
        console.log("[RelationshipUpdate] Checking for existing request");
        const existingRequest = newRelationships.find(
          (r) =>
            r.id === payload.id ||
            (r.sender_id === payload.sender_id &&
              r.recipient_id === payload.recipient_id),
        );

        if (!existingRequest) {
          console.log("[RelationshipUpdate] Adding new relationship request");
          // Add the request if we're either the sender or recipient
          if (
            payload.sender_id === currentUserId ||
            payload.recipient_id === currentUserId
          ) {
            newRelationships.push(payload);
            console.log("[RelationshipUpdate] Added request:", payload);
          }
        } else {
          console.log(
            "[RelationshipUpdate] Request already exists:",
            existingRequest,
          );
        }
        break;

      case "relationshipAccept":
        console.log("[RelationshipUpdate] Accepting relationship");
        // Remove from requests when accepted
        const requestIndex = newRelationships.findIndex(
          (r) =>
            r.id === payload.id ||
            (r.sender_id === payload.sender_id &&
              r.recipient_id === payload.recipient_id),
        );
        if (requestIndex !== -1) {
          newRelationships.splice(requestIndex, 1);
        }

        // Add to relationships array
        const friendId =
          payload.sender_id === currentUserId
            ? payload.recipient_id
            : payload.sender_id;
        setRelationships((prev) => {
          // Check if not already in relationships
          if (!prev.includes(friendId)) {
            return [...prev, friendId];
          }
          return prev;
        });
        break;

      case "relationshipDelete":
        console.log("[RelationshipUpdate] Deleting relationship");
        // Remove from both requests and relationships
        const deleteIndex = newRelationships.findIndex(
          (r) =>
            r.id === payload.id ||
            (r.sender_id === payload.sender_id &&
              r.recipient_id === payload.recipient_id),
        );
        if (deleteIndex !== -1) {
          newRelationships.splice(deleteIndex, 1);
        }

        // Remove from relationships array
        const removedFriendId =
          payload.sender_id === currentUserId
            ? payload.recipient_id
            : payload.sender_id;
        setRelationships((prev) => prev.filter((id) => id !== removedFriendId));
        break;
    }

    return newRelationships;
  });
};
