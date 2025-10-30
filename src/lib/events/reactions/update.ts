interface ReactionEventData {
  type: string;
  message_id: string;
  room_id: string;
  user_id: string;
  emoji: string;
  count: number;
  users: string[];
}

export const handleReactionUpdate = (data: ReactionEventData, cache: any) => {
  console.log("[WebSocket] Handling reaction event:", data);

  const { message_id, room_id, emoji, count, users, type } = data;

  // Get the message from cache
  const message = cache.getMessage(room_id, message_id);
  if (!message) {
    console.log(
      `[WebSocket] Message ${message_id} not found in cache for reaction update`,
    );
    return;
  }

  // Initialize reactions if they don't exist
  if (!message.reactions) {
    message.reactions = {};
  }

  // Update the reaction data
  if (count > 0) {
    message.reactions[emoji] = { count, users };
  } else {
    // Remove the reaction if count is 0
    delete message.reactions[emoji];
  }

  // Update the message in cache
  cache.updateMessage(room_id, message_id, { reactions: message.reactions });

  console.log(
    `[WebSocket] Updated reaction ${emoji} for message ${message_id}: count=${count}, users=${users.length}`,
  );
};
