import { apiRequest } from "../api";
import { BASE_URL } from "../../constants";

export interface ReactionData {
  count: number;
  users: string[];
}

export interface AddReactionResponse {
  message: string;
  emoji: string;
  count: number;
  users: string[];
}

export interface RemoveReactionResponse {
  message: string;
  emoji: string;
  count: number;
  users: string[];
}

export const addReaction = async (
  roomId: string,
  messageId: string,
  emoji: string,
): Promise<AddReactionResponse> => {
  return await apiRequest<AddReactionResponse>(
    `${BASE_URL}/rooms/${roomId}/messages/${messageId}/reactions`,
    {
      method: "POST",
      body: { emoji },
    },
  );
};

export const removeReaction = async (
  roomId: string,
  messageId: string,
  emoji: string,
): Promise<RemoveReactionResponse> => {
  return await apiRequest<RemoveReactionResponse>(
    `${BASE_URL}/rooms/${roomId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    {
      method: "DELETE",
    },
  );
};

export const getMessageReactions = async (
  roomId: string,
  messageId: string,
): Promise<Record<string, ReactionData>> => {
  return await apiRequest<Record<string, ReactionData>>(
    `${BASE_URL}/rooms/${roomId}/messages/${messageId}/reactions`,
    {
      method: "GET",
    },
  );
};
