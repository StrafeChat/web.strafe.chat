import {
  createContext,
  createSignal,
  useContext,
  createEffect,
  ParentComponent,
  createMemo,
  onCleanup,
  onMount,
} from "solid-js";
import { WebSocketClient } from "../../ws/WebSocketClient";
import { useCache } from "../cache/CacheProvider";
import { handleWebSocketMessage } from "../../events";
import { BASE_URL, WS_URL } from "../../../constants";
import { api } from "../../api";
import { RoomWithRecipients } from "../../../types/rooms";

export const API_ENDPOINTS = {
  REGISTER: `${BASE_URL}/auth/register`,
  LOGIN: `${BASE_URL}/auth/login`,
  USER_ME: `${BASE_URL}/users/@me`,
  RELATIONSHIPS: `${BASE_URL}/users/@me/relationships`,
  CREATE_ROOM: `${BASE_URL}/users/@me/rooms`,
  ROOM_MESSAGES: (roomId: string) => `${BASE_URL}/rooms/${roomId}/messages`,
  UPDATE_STATUS: `${BASE_URL}/users/@me/status`,
  BULK_USERS: `${BASE_URL}/users/bulk`,
  TYPING_INDICATOR: (roomId: string) => `${BASE_URL}/rooms/${roomId}/typing`,
};

const API_HEADERS = {
  JSON: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  SESSION: () => ({
    "X-Session-Token": localStorage.getItem("sc_token") || "",
  }),
};

export type Clientuser = {
  id: string;
  username: string;
  discriminator: string;
  friends?: string[];
  display_name?: string;
  email: string;
  date_of_birth?: string;
  avatar?: string;
  banner?: string;
  presence?: {
    status: string;
    custom_status: string;
  };
};

type AuthContextType = {
  user: () => Clientuser | null;
  setUser: (user: Clientuser | null) => void;
  updateUser: (user: Partial<Clientuser>) => void;
  relationships: () => string[];
  setRelationships: (relationships: string[]) => void;
  relationshipRequests: () => Relationship[];
  setRelationshipRequests: (requests: Relationship[]) => void;
  rooms: () => RoomWithRecipients[];
  setRooms: (rooms: RoomWithRecipients[]) => void;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => void;
  isAuthenticated: () => boolean;
  loading: () => boolean;
  isMobile: () => boolean;
  wsClient: () => WebSocketClient | null;
  updateStatus: (status?: string, customStatus?: string) => Promise<boolean>;
  fetchBulkUsers: (userIds: string[]) => Promise<void>;
  sendMessage: (roomId: string, messageData: { content: string; nonce?: string; message_references?: string[] }) => Promise<MessageResponse>;
  sendTypingIndicator: (roomId: string) => Promise<void>;
  deleteMessage: (roomId: string, messageId: string) => Promise<{ success: boolean; error?: string; }>;
  editMessage: (roomId: string, messageId: string, content: string) => Promise<{ success: boolean; message?: any; error?: string; }>;
  unreadMessages: () => { [roomId: string]: string[] };
  setUnreadMessages: (unreads: { [roomId: string]: string[] } | ((prev: { [roomId: string]: string[] }) => { [roomId: string]: string[] })) => void;
  fetchUnreadMessages: (roomId: string) => Promise<void>;
  markMessagesAsRead: (roomId: string) => Promise<void>;
};

type LoginCredentials = {
  email: string;
  password: string;
};

type RegisterData = {
  username: string;
  discriminator: number;
  display_name?: string;
  email: string;
  password: string;
  date_of_birth: string;
};

type Relationship = {
  id: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  type?: string;
};

type AuthResponse = {
  success: boolean;
  error?: string;
};

type MessageResponse = {
  success: boolean;
  message?: any;
  error?: string;
};

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const cache = useCache();
  const [user, setUser] = createSignal<Clientuser | null>(null);
  const [relationships, setRelationships] = createSignal<string[]>([]);
  const [relationshipRequests, setRelationshipRequests] = createSignal<Relationship[]>([]);
  const [rooms, setRooms] = createSignal<RoomWithRecipients[]>([]);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [isMobile, setIsMobile] = createSignal(window.innerWidth <= 768);
  const [wsClient, setWsClient] = createSignal<WebSocketClient | null>(null);
  const [unreadMessages, setUnreadMessages] = createSignal<{ [roomId: string]: string[] }>({});

  const mobileCheck = createMemo(() => isMobile());

  // Handle window resize for mobile detection
  createEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  const initializeWebSocket = (token: string = localStorage.getItem("sc_token") || "") => {
    if (!token) return false;

    const ws = new WebSocket(WS_URL);
    const client = new WebSocketClient(ws);
    setWsClient(client);

    client.onConnectionStateChange((connected) => {
      console.log("[AuthProvider] WebSocket connection state:", connected);
      if (!connected && !localStorage.getItem("sc_token")) setLoading(true);
    });

    client.connect(token).catch((error) => {
      console.error("[WebSocket] Failed to connect:", error);
    });

    setupWebSocketHandlers(client);
    return true;
  };

  const setupWebSocketHandlers = (client: WebSocketClient) => {
    client.onMessage("READY", handleReadyEvent);
    client.onMessage("relationshipCreate", handleRelationshipEvent);
    client.onMessage("relationshipAccept", handleRelationshipAcceptEvent);
    client.onMessage("relationshipDelete", handleRelationshipEvent);
    client.onMessage("ROOM_CREATE", handleRoomCreateEvent);
    client.onMessage("presence", handlePresenceEvent);
    client.onMessage("MESSAGE_CREATE", handleMessageCreateEvent);
  };

  const handleReadyEvent = (data: any) => {
    if (data.client_user) {
      const userData = normalizeUserData(data.client_user);
      setUser(userData);
      setIsAuthenticated(true);
      cache.setUser(userData);
    }

    if (data.users) {
      cache.setUsers(data.users);
    }

    if (data.relationships) {
      setRelationships(data.relationships);
    }

    if (data.relationship_requests) {
      const requests = normalizeRelationshipRequests(data.relationship_requests);
      setRelationshipRequests(requests);
    }

    if (data.rooms) {
      const roomsData = normalizeRoomsData(data.rooms, data.users);
      setRooms(roomsData);
    }

    // Handle unread messages from READY event
    if (data.unread_messages) {
      console.log("[AuthProvider] Received unread messages in READY event:", data.unread_messages);
      setUnreadMessages(data.unread_messages);
      
      // Update room unread counts based on unread messages
      if (data.rooms) {
        setRooms(rooms => {
          return rooms.map(room => {
            const roomUnreads = data.unread_messages?.[room.id] || [];
            return {
              ...room,
              unread_count: roomUnreads.length
            };
          });
        });
      }
    }

    if (!data.client_user || !data.users) {
      console.error("[AuthProvider:READY] Missing required data");
      return;
    }

    setLoading(false);
  };

  const normalizeUserData = (userData: any): Clientuser => ({
    id: userData.ID,
    username: userData.Username,
    discriminator: userData.Discriminator,
    display_name: userData.DisplayName || userData.Username,
    email: userData.Email,
    avatar: userData.Avatar,
    banner: userData.Banner,
    date_of_birth: userData.DateOfBirth,
    friends: userData.Friends || [],
    presence: userData.Presence ? {
      status: userData.Presence.Status || "offline",
      custom_status: userData.Presence.CustomStatus || "",
    } : undefined,
  });

  const normalizeRelationshipRequests = (requests: any[]): Relationship[] =>
    requests.map((request) => ({
      id: request.ID,
      sender_id: request.SenderID,
      recipient_id: request.RecipientID,
      created_at: request.CreatedAt || new Date().toISOString(),
    }));

  const normalizeRoomsData = (rooms: any, users: any): RoomWithRecipients[] =>
    Object.values(rooms).map((room: any) => ({
      id: room.ID,
      name: room.Name,
      type: room.Type,
      recipients: room.Recipients || [],
      owner_id: room.OwnerID,
      last_message_id: room.LastMessageID,
      icon: room.Icon,
      created_at: room.CreatedAt,
      updated_at: room.UpdatedAt,
      recipients_data: room.Recipients?.map((recipientId: string) =>
        users?.[recipientId] ? {
          id: recipientId,
          username: users[recipientId].Username,
          discriminator: users[recipientId].Discriminator,
          display_name: users[recipientId].DisplayName || users[recipientId].Username,
          avatar: users[recipientId].Avatar,
          presence: users[recipientId].Presence,
        } : null
      ).filter(Boolean)
    }));

  const handleRelationshipEvent = (data: any) => {
    handleWebSocketMessage(
      { type: data.type, ...data },
      cache,
      setRelationshipRequests,
      setRelationships,
      user()?.id || "",
    );
  };

  const handleRelationshipAcceptEvent = (data: any) => {
    handleRelationshipEvent(data);
    const currentUser = user();
    if (currentUser) {
      const otherUserId = currentUser.id === data.sender_id ? data.recipient_id : data.sender_id;
      setUser({
        ...currentUser,
        friends: [...(currentUser.friends || []), otherUserId],
      });
    }
  };

  const handleRoomCreateEvent = (data: any) => {
    const roomData = data.data || data;
    const newRoom = {
      id: roomData.id,
      name: roomData.name || "",
      type: roomData.type || 0,
      recipients: roomData.recipients || [],
      owner_id: roomData.owner_id || "",
      last_message_id: roomData.last_message_id || null,
      icon: roomData.icon || null,
      created_at: roomData.created_at || new Date().toISOString(),
      updated_at: roomData.updated_at || null,
      recipients_data: roomData.recipients?.map((recipientId: string) => {
        const userData = cache.getUser(recipientId);
        return userData ? {
          id: recipientId,
          username: userData.username,
          discriminator: userData.discriminator,
          display_name: userData.display_name || userData.username,
          avatar: userData.avatar,
          presence: userData.presence
        } : null;
      }).filter(Boolean)
    };
    
    setRooms(prev => [...prev, newRoom]);
  };

  const sendTypingIndicator = async (roomId: string): Promise<void> => {
    try {
      const response = await fetch(API_ENDPOINTS.TYPING_INDICATOR(roomId), {
        method: 'POST',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        }
      });

      if (!response.ok) {
        console.error('[AuthProvider] Failed to send typing indicator:', await response.text());
      }
    } catch (error) {
      console.error('[AuthProvider] Error sending typing indicator:', error);
    }
  };

  const handlePresenceEvent = (data: any) => {
    const presence = {
      status: data.status || "offline",
      custom_status: data.custom_status || ""
    };

    if (data.user_id === user()?.id) {
      const currentUser = user()!;
      const updatedUser = {
        ...currentUser,
        presence
      };
      setUser(updatedUser);
      cache.setUser({
        ...currentUser,
        presence
      });
    } else {
      const cachedUser = cache.getUser(data.user_id);
      if (cachedUser) {
        cache.setUser({
          ...cachedUser,
          presence
        });
      }
    }
  };

  const fetchUserData = async (token: string): Promise<AuthResponse> => {
    try {
      const data = await api.users.me();
      if (!data?.client_user) {
        setLoading(false);
        return { success: false, error: "Invalid response format" };
      }

      const userData = normalizeUserData(data.client_user);
      setUser(userData);

      if (data.relationships) {
        setRelationships(data.relationships);
      }

      initializeWebSocket(token);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      setLoading(false);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      setLoading(true);
      const data = await api.auth.login(credentials);
      if (!data?.token) return { success: false, error: "No token in response" };

      localStorage.setItem("sc_token", data.token);
      const result = await fetchUserData(data.token);
      setIsAuthenticated(result.success);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    try {
      setLoading(true);
      const response = await api.auth.register(data);
      if (!response?.token) return { success: false, error: "No token in response" };

      localStorage.setItem("sc_token", response.token);
      const result = await fetchUserData(response.token);
      setIsAuthenticated(result.success);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("sc_token");
    window.location.replace("/login");
    setUser(null);
    setIsAuthenticated(false);
    setLoading(false);
    wsClient()?.disconnect();
    setWsClient(null);
  };

  const updateUser = (userUpdate: Partial<Clientuser>) => {
    const currentUser = user();
    if (!currentUser) return;

    const updatedUser = {
      ...currentUser,
      ...Object.fromEntries(
        Object.entries(userUpdate).filter(([_, value]) => value !== undefined),
      ),
    };

    setUser(updatedUser);
    cache.setUser(updatedUser);
  };

  const updateStatus = async (status?: string, customStatus?: string): Promise<boolean> => {
    try {
      const res = await fetch(API_ENDPOINTS.UPDATE_STATUS, {
        method: "PATCH",
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify({
          status,
          custom_status: customStatus,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      const updatedUser = await res.json();
      setUser(updatedUser);
      cache.setUser(updatedUser);
      return true;
    } catch (error) {
      console.error("Error updating status:", error);
      return false;
    }
  };

  const fetchBulkUsers = async (userIds: string[]): Promise<void> => {
    if (!userIds.length) return;
    
    try {
      for (let i = 0; i < userIds.length; i += 100) {
        const batch = userIds.slice(i, i + 100);
        
        const response = await fetch(API_ENDPOINTS.BULK_USERS, {
          method: "POST", // Changed to POST as it's more appropriate for sending data in request body
          headers: {
            ...API_HEADERS.JSON,
            ...API_HEADERS.SESSION(),
          },
          body: JSON.stringify({ ids: batch })
        });

        if (!response.ok) {
          console.error("Failed to fetch user data:", response.status);
          continue;
        }

        const userData = await response.json();
        if (userData?.users) {
          Object.entries(userData.users).forEach(([userId, userData]: [string, any]) => {
            cache.setUser({
              id: userId,
              username: userData.Username,
              discriminator: userData.Discriminator,
              display_name: userData.DisplayName,
              avatar: userData.Avatar,
              banner: userData.Banner,
              presence: userData.Presence ? {
                status: userData.Presence.Status,
                custom_status: userData.Presence.CustomStatus
              } : undefined
            });
          });
        }
      }
    } catch (error) {
      console.error("Error fetching bulk user data:", error);
    }
  };

  const sendMessage = async (roomId: string, messageData: { content: string; nonce?: string; message_references?: string[] }): Promise<MessageResponse> => {
    try {
      if (!roomId || !messageData.content.trim()) {
        return { success: false, error: "Room ID and message content are required" };
      }

      const response = await fetch(API_ENDPOINTS.ROOM_MESSAGES(roomId), {
        method: "POST",
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || `Failed to send message: ${response.status}`,
        };
      }

      const responseData = await response.json();
      return { success: true, message: responseData };
    } catch (error) {
      console.error("Error sending message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  onCleanup(() => {
    const client = wsClient();
    if (client) {
      client.disconnect();
      setWsClient(null);
    }
    window.removeEventListener("resize", () => setIsMobile(window.innerWidth <= 768));
  });

  // Initialize authentication on component mount
  createEffect(() => {
    const initializeAuth = () => {
      const token = localStorage.getItem("sc_token");
      if (token) {
        initializeWebSocket(token);
        fetchUserData(token).catch(() => {
          localStorage.removeItem("sc_token");
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    };
    
    initializeAuth();
  });
  
  // Set up global functions for WebSocketClient to access
  onMount(() => {
    window.getCurrentRooms = () => rooms();
    window.getCurrentUser = () => user();
    // ... existing code...
    window.setUnreadMessages = (unreads: ((prev: { [roomId: string]: string[] }) => { [roomId: string]: string[] }) | { [roomId: string]: string[] }) => {
      console.log("[AuthProvider] Setting unread messages:", unreads);
      if (typeof unreads === 'function') {
        setUnreadMessages(prev => unreads(prev));
      } else {
        setUnreadMessages(unreads);
      }
    };
  });

  const deleteMessage = async (roomId: string, messageId: string) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ROOM_MESSAGES(roomId)}/${messageId}`, {
        method: "DELETE",
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || `Failed to delete message: ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Error deleting message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const editMessage = async (roomId: string, messageId: string, content: string) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ROOM_MESSAGES(roomId)}/${messageId}`, {
        method: "PATCH",
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || `Failed to edit message: ${response.status}`,
        };
      }

      const responseData = await response.json();
      return { success: true, message: responseData };
    } catch (error) {
      console.error("Error editing message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  // Handle new message events to update unread messages
  const handleMessageCreateEvent = (data: any) => {
    const messageData = data.data || data;
    if (!messageData.room_id || !messageData.id) return;
    
    const currentUser = user();
    if (!currentUser) return;
    
    // Check if user is currently viewing this room
    const currentLocation = window.location.pathname;
    const isViewingThisRoom = currentLocation.includes(`/rooms/${messageData.room_id}`);
    
    // Create a normalized message object
    const normalizedMessage = {
      id: messageData.id,
      content: messageData.content || "",
      author_id: messageData.author_id || messageData.sender_id || "",
      room_id: messageData.room_id,
      created_at: messageData.created_at || new Date().toISOString(),
      edited_at: messageData.edited_at || null,
      attachments: messageData.attachments || [],
    };
    
    // Add message to cache
    if (window.messageCache) {
      console.log("[AuthProvider] Adding message to cache:", normalizedMessage);
      window.messageCache.addMessage(messageData.room_id, normalizedMessage);
    }
    
    // Dispatch messageCreate event for UI components to listen to
    // This is critical for real-time updates in the ChatArea component
    console.log("[AuthProvider] Dispatching messageCreate event");
    window.dispatchEvent(new CustomEvent("messageCreate", {
      detail: {
        roomId: messageData.room_id,
        message: normalizedMessage
      }
    }));
    
    // Don't mark as unread if user is viewing this room or in DND mode
    if (isViewingThisRoom || currentUser.presence?.status === "dnd") return;
    
    // Update unread messages
    setUnreadMessages((prev: { [roomId: string]: string[] }) => {
      const updated = { ...prev };
      if (!updated[messageData.room_id]) {
        updated[messageData.room_id] = [];
      }
      
      // Add the message ID if it's not already in the list
      if (!updated[messageData.room_id].includes(messageData.id)) {
        updated[messageData.room_id] = [...updated[messageData.room_id], messageData.id];
      }
      
      return updated;
    });
    
    // Update room unread count
    setRooms((rooms: RoomWithRecipients[]) => {
      return rooms.map(room => {
        if (room.id === messageData.room_id) {
          return {
            ...room,
            unread_count: (room.unread_count || 0) + 1,
            last_message_id: messageData.id
          };
        }
        return room;
      });
    });
  };

  const fetchUnreadMessages = async (roomId: string): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/rooms/${roomId}/unreads`, {
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });
      if (response.ok) {
        const unreads = await response.json();
        setUnreadMessages(prev => ({
          ...prev,
          [roomId]: unreads.map((u: any) => u.message_id)
        }));
      }
    } catch (error) {
      console.error('Failed to fetch unread messages:', error);
    }
  };

  const markMessagesAsRead = async (roomId: string): Promise<void> => {
    try {
      // Use the ack endpoint to acknowledge messages in a room
      await fetch(`${BASE_URL}/rooms/${roomId}/ack`, {
        method: 'POST',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });
      
      // Clear unread messages for this room
      setUnreadMessages((prev: { [roomId: string]: string[] }) => {
        const updated = { ...prev };
        delete updated[roomId];
        return updated;
      });

      // Also update the room's unread_count to 0
      setRooms((rooms: RoomWithRecipients[]) => {
        return rooms.map((room: RoomWithRecipients) => {
          if (room.id === roomId) {
            return {
              ...room,
              unread_count: 0
            };
          }
          return room;
        });
      });

    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: () => user(),
        setUser,
        updateUser,
        relationshipRequests: () => relationshipRequests(),
        setRelationshipRequests,
        relationships: () => relationships(),
        setRelationships,
        rooms: () => rooms(),
        setRooms,
        login,
        register,
        logout,
        isAuthenticated: () => isAuthenticated(),
        loading: () => loading(),
        isMobile: mobileCheck,
        wsClient: () => wsClient(),
        updateStatus,
        fetchBulkUsers,
        sendMessage,
        deleteMessage,
        editMessage,
        unreadMessages: () => unreadMessages(),
        setUnreadMessages,
        fetchUnreadMessages,
        markMessagesAsRead,
        sendTypingIndicator,
      }}
      data-auth-provider
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// ...existing code ...
