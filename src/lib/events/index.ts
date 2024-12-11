import { handleRelationshipUpdate } from "./relationships/update";
import { handlePresenceUpdate } from "./presence/update";
import { handleUserUpdate } from "./users/update";

export const handleWebSocketMessage = async (
  data: any,
  cache: any,
  setRelationships: (updater: (prev: any[]) => any[]) => void
) => {
  console.log("[WebSocket] Processing message:", {
    type: data.type,
    payload: data,
    currentRelationships: cache.relationships,
    cacheState: cache
  });
  
  switch (data.type) {
    case "relationshipCreate":
    case "relationshipAccept":
    case "relationshipDelete":
      console.log("[WebSocket] Handling relationship event:", {
        type: data.type,
        data: data
      });
      await handleRelationshipUpdate(data, cache, setRelationships);
      break;
    
    case "presenceUpdate":
      handlePresenceUpdate(data, cache);
      break;
    
    case "userUpdate":
      handleUserUpdate(data, cache);
      break;
    
    default:
      console.warn("[WebSocket] Unhandled event type:", data.type);
  }
};
