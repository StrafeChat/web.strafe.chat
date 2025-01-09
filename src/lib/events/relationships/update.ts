import { RelationshipPayload } from "../../../types/relationships";
import { BASE_URL } from "../../../constants";

export const handleRelationshipUpdate = async (
  payload: RelationshipPayload,
  cache: any,
  setRelationshipRequests: (updater: (prev: any[]) => any[]) => void
) => {
  console.log("[RelationshipUpdate] Processing payload:", {
    payload,
    currentCache: cache.users(),
  });

  const usersToFetch = [payload.sender_id, payload.recipient_id].filter(
    (userId) => !cache.getUser(userId)
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
        friends: userData.friends || [],
      });
    } catch (error) {
      console.error("[RelationshipUpdate] Failed to fetch user data:", error);
    }
  }

  setRelationshipRequests((prev) => {
    console.log("[RelationshipUpdate] Current relationships:", prev);
    const newRelationships = [...prev];

    switch (payload.type) {
      case "relationshipCreate":
        const existingIndex = newRelationships.findIndex(
          (r) => r.id === payload.id
        );
        if (existingIndex === -1) {
          newRelationships.push({
            id: payload.id,
            sender_id: payload.sender_id,
            recipient_id: payload.recipient_id,
            created_at: payload.created_at,
          });
        }
        break;

      case "relationshipAccept":
        const acceptIndex = newRelationships.findIndex(
          (r) => r.id === payload.id
        );
        if (acceptIndex !== -1) {
          // Remove from pending requests
          newRelationships.splice(acceptIndex, 1);
        }
        break;

      case "relationshipDelete":
        const deleteIndex = newRelationships.findIndex(
          (r) => r.id === payload.id
        );
        if (deleteIndex !== -1) {
          newRelationships.splice(deleteIndex, 1);
        }
        break;
    }

    console.log(
      "[RelationshipUpdate] Updated relationships:",
      newRelationships
    );
    return newRelationships;
  });
};
