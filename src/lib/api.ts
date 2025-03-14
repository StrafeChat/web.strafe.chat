import { API_ENDPOINTS } from "./providers/auth/AuthProvider";
import { UserMeResponse, LoginResponse, RegisterResponse, BulkUsersResponse, UpdateStatusResponse } from "../types/api";

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

const getSessionToken = () => localStorage.getItem("sc_token") || "";

const defaultHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const createHeaders = (additionalHeaders: Record<string, string> = {}) => {
  const sessionToken = getSessionToken();
  return {
    ...defaultHeaders,
    ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
    ...additionalHeaders,
  };
};

export const apiRequest = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const { method = "GET", body, headers = {} } = options;

  const response = await fetch(endpoint, {
    method,
    headers: createHeaders(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiRequest<LoginResponse>(API_ENDPOINTS.LOGIN, {
        method: "POST",
        body: credentials,
      }),
    register: (data: any) =>
      apiRequest<RegisterResponse>(API_ENDPOINTS.REGISTER, {
        method: "POST",
        body: data,
      }),
  },
  users: {
    me: () => apiRequest<UserMeResponse>(API_ENDPOINTS.USER_ME),
    bulkFetch: (userIds: string[]) =>
      apiRequest<BulkUsersResponse>(API_ENDPOINTS.BULK_USERS, {
        method: "POST",
        body: { user_ids: userIds },
      }),
    updateStatus: (status?: string, customStatus?: string) =>
      apiRequest<UpdateStatusResponse>(API_ENDPOINTS.UPDATE_STATUS, {
        method: "POST",
        body: { status, custom_status: customStatus },
      }),
  },
  relationships: {
    list: () => apiRequest(API_ENDPOINTS.RELATIONSHIPS),
    create: (userId: string) =>
      apiRequest(API_ENDPOINTS.RELATIONSHIPS, {
        method: "POST",
        body: { user_id: userId },
      }),
    accept: (userId: string) =>
      apiRequest(`${API_ENDPOINTS.RELATIONSHIPS}/${userId}/accept`, {
        method: "POST",
      }),
    reject: (userId: string) =>
      apiRequest(`${API_ENDPOINTS.RELATIONSHIPS}/${userId}/reject`, {
        method: "POST",
      }),
  },
  rooms: {
    create: (data: any) =>
      apiRequest(API_ENDPOINTS.CREATE_ROOM, {
        method: "POST",
        body: data,
      }),
    messages: {
      list: (roomId: string) => apiRequest(API_ENDPOINTS.ROOM_MESSAGES(roomId)),
      send: (roomId: string, data: any) =>
        apiRequest(API_ENDPOINTS.ROOM_MESSAGES(roomId), {
          method: "POST",
          body: data,
        }),
      edit: (roomId: string, messageId: string, content: string) =>
        apiRequest(`${API_ENDPOINTS.ROOM_MESSAGES(roomId)}/${messageId}`, {
          method: "PATCH",
          body: { content },
        }),
      delete: (roomId: string, messageId: string) =>
        apiRequest(`${API_ENDPOINTS.ROOM_MESSAGES(roomId)}/${messageId}`, {
          method: "DELETE",
        }),
    },
    typing: {
      indicate: (roomId: string) =>
        apiRequest(API_ENDPOINTS.TYPING_INDICATOR(roomId), {
          method: "POST",
        }),
    },
  },
};