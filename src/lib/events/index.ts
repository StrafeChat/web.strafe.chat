import { handleRelationshipUpdate } from "./relationships/update";
import { handlePresenceUpdate } from "./presence/update";
import { handleUserUpdate } from "./users/update";

export const handleWebSocketMessage = async (
  data: any,
  cache: any,
  setRelationshipRequests: (updater: (prev: any[]) => any[]) => void,
  setRelationships: (updater: (prev: string[]) => string[]) => void,
  currentUserId: string,
) => {
  console.log("[WebSocket] Processing message:", {
    type: data.type,
    payload: data,
    currentUserId,
  });

  switch (data.type) {
    case "relationshipCreate":
    case "relationshipAccept":
    case "relationshipDelete":
      console.log("[WebSocket] Handling relationship event:", {
        type: data.type,
        data: data,
      });
      await handleRelationshipUpdate(
        data,
        cache,
        setRelationshipRequests,
        setRelationships,
        currentUserId,
      );
      break;

    case "presenceUpdate":
      handlePresenceUpdate(data, cache);
      break;

    case "userUpdate":
      handleUserUpdate(data, cache);
      break;

    default:
      console.log("[WebSocket] Unhandled message type:", data.type);
  }
};
