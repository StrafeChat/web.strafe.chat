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
  PASSWORD_RESET: `${BASE_URL}/auth/password-reset`,
  PASSWORD_RESET_VERIFY: `${BASE_URL}/auth/password-reset/verify`,
  PASSWORD_RESET_COMPLETE: `${BASE_URL}/auth/password-reset/complete`,
  USER_ME: `${BASE_URL}/users/@me`,
  RELATIONSHIPS: `${BASE_URL}/users/@me/relationships`,
  CREATE_ROOM: `${BASE_URL}/users/@me/rooms`,
  USER_ROOMS: `${BASE_URL}/users/@me/rooms`,
  ROOM_MESSAGES: (roomId: string) => `${BASE_URL}/rooms/${roomId}/messages`,
  UPDATE_STATUS: `${BASE_URL}/users/@me/status`,
  BULK_USERS: `${BASE_URL}/users/bulk`,
  TYPING_INDICATOR: (roomId: string) => `${BASE_URL}/rooms/${roomId}/typing`,
  SESSIONS: `${BASE_URL}/users/@me/sessions`,
  ROOMS: `${BASE_URL}/rooms`,
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
  bio?: string;
  about_me?: string;
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
  setRooms: (rooms: RoomWithRecipients[] | ((prev: RoomWithRecipients[]) => RoomWithRecipients[])) => void;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => void;
  isAuthenticated: () => boolean;
  loading: () => boolean;
  isMobile: () => boolean;
  wsClient: () => WebSocketClient | null;
  updateStatus: (status?: string, customStatus?: string) => Promise<boolean>;
  fetchBulkUsers: (userIds: string[]) => Promise<void>;
  sendMessage: (roomId: string, messageData: { content: string; nonce?: string; message_references?: string[]; attachments?: string[] }) => Promise<MessageResponse>;
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
  message?: string;
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

    // Setup handlers BEFORE connecting
    setupWebSocketHandlers(client);

    client.connect(token).catch((error) => {
      console.error("[WebSocket] Failed to connect:", error);
    });

    return true;
  };

  const setupWebSocketHandlers = (client: WebSocketClient) => {
    client.onMessage("READY", handleReadyEvent);
    client.onMessage("relationshipCreate", handleRelationshipEvent);
    client.onMessage("relationshipAccept", handleRelationshipAcceptEvent);
    client.onMessage("relationshipDelete", handleRelationshipEvent);
    client.onMessage("ROOM_CREATE", handleRoomCreateEvent);
    client.onMessage("ROOM_DELETE", handleRoomDeleteEvent);
    client.onMessage("ROOM_UPDATE", handleRoomUpdateEvent);
    client.onMessage("ROOM_MEMBER_ADD", handleRoomMemberAddEvent);
    client.onMessage("ROOM_MEMBER_REMOVE", handleRoomMemberRemoveEvent);
    client.onMessage("ROOM_OWNERSHIP_TRANSFER", handleRoomOwnershipTransferEvent);
    client.onMessage("presence", handlePresenceEvent);
    console.log("[AuthProvider] Registering MESSAGE_CREATE handler");
    client.onMessage("MESSAGE_CREATE", handleMessageCreateEvent);
    console.log("[AuthProvider] Registering MESSAGE_EDIT handler");
    client.onMessage("MESSAGE_EDIT", handleMessageEditEvent);
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
    
    // Remove initial HTML loading screen
    if (window.removeInitialLoadingScreen) {
      window.removeInitialLoadingScreen();
    }
  };

  const normalizeUserData = (userData: any): Clientuser => ({
    id: userData.id || userData.ID,
    username: userData.username || userData.Username,
    discriminator: userData.discriminator || userData.Discriminator,
    display_name: userData.display_name || userData.DisplayName || userData.username || userData.Username,
    email: userData.email || userData.Email,
    avatar: userData.avatar || userData.Avatar,
    banner: userData.banner || userData.Banner,
    bio: userData.bio || userData.Bio,
    about_me: userData.about_me || userData.AboutMe,
    date_of_birth: userData.date_of_birth || userData.DateOfBirth,
    friends: userData.friends || userData.Friends || [],
    presence: (userData.presence || userData.Presence) ? {
      status: (userData.presence?.status || userData.Presence?.Status) || "offline",
      custom_status: (userData.presence?.custom_status || userData.Presence?.CustomStatus) || "",
    } : undefined,
  });

  const normalizeRelationshipRequests = (requests: any[]): Relationship[] =>
    requests.map((request) => ({
      id: request.id || request.ID,
      sender_id: request.sender_id || request.SenderID,
      recipient_id: request.recipient_id || request.RecipientID,
      created_at: request.created_at || request.CreatedAt || new Date().toISOString(),
    }));

  const normalizeRoomsData = (rooms: any, users: any): RoomWithRecipients[] =>
    Object.values(rooms).map((room: any) => ({
      id: room.ID || room.id,
      name: room.Name || room.name || "",
      type: room.Type || room.type || 0,
      recipients: room.Recipients || room.recipients || [],
      owner_id: room.Creator || room.creator || room.OwnerID || room.owner_id || "",
      last_message_id: room.LastMessageID || room.LastMessageId || room.last_message_id || null,
      icon: room.Icon || room.icon || null,
      topic: room.Topic || room.topic || "",
      created_at: room.CreatedAt || room.created_at || new Date().toISOString(),
      updated_at: room.UpdatedAt || room.updated_at || null,
      recipients_data: (room.Recipients || room.recipients || [])?.map((recipientId: string) =>
        users?.[recipientId] ? {
          id: recipientId,
          username: users[recipientId].Username || users[recipientId].username,
          discriminator: users[recipientId].Discriminator || users[recipientId].discriminator,
          display_name: (users[recipientId].DisplayName || users[recipientId].display_name || users[recipientId].Username || users[recipientId].username),
          avatar: users[recipientId].Avatar || users[recipientId].avatar,
          presence: users[recipientId].Presence || users[recipientId].presence,
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
      owner_id: roomData.creator || roomData.owner_id || "",
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
    
    setRooms(prev => [...prev, newRoom as RoomWithRecipients]);
  };

  const handleRoomDeleteEvent = (data: any) => {
    const roomData = data.data || data;
    const roomId = roomData.room_id;
    
    if (roomId) {
      console.log("[AuthProvider] Room deleted:", roomId);
      setRooms(prev => prev.filter(room => room.id !== roomId));
      
      // If user is currently viewing the deleted room, redirect to home
      const currentLocation = window.location.pathname;
      if (currentLocation.includes(`/rooms/${roomId}`)) {
        window.location.href = '/';
      }
    }
  };

  const handleRoomUpdateEvent = (data: any) => {
    const roomData = data.data || data;
    const roomId = roomData.room_id;
    
    if (roomId) {
      console.log("[AuthProvider] Room updated:", roomData);
      
      setRooms(prev => prev.map(room => {
        if (room.id === roomId) {
          const updatedRoom = { ...room };
          
          // Update name if provided
          if (roomData.name !== undefined) {
            updatedRoom.name = roomData.name;
          }
          
          // Update topic if provided
          if (roomData.topic !== undefined) {
            updatedRoom.topic = roomData.topic;
          }
          
          // Update icon if provided
          if (roomData.icon !== undefined) {
            updatedRoom.icon = roomData.icon;
          }
          
          // Update timestamp
          updatedRoom.updated_at = new Date().toISOString();
          
          return updatedRoom;
        }
        return room;
      }));
    }
  };

  const handleRoomMemberAddEvent = (data: any) => {
    const roomData = data.data || data;
    const roomId = roomData.room_id;
    const userId = roomData.user_id;
    const recipients = roomData.recipients || [];
    
    if (roomId && userId) {
      console.log("[AuthProvider] Member added to room:", { roomId, userId });
      
      setRooms(prev => prev.map(room => {
        if (room.id === roomId) {
          // Update recipients list
          const updatedRecipients = [...recipients];
          const updatedRecipientsData = updatedRecipients.map((recipientId: string) => {
            const userData = cache.getUser(recipientId);
            return userData ? {
              id: recipientId,
              username: userData.username,
              discriminator: userData.discriminator,
              display_name: userData.display_name || userData.username,
              avatar: userData.avatar,
              presence: userData.presence
            } : null;
          }).filter(Boolean);
          
          return {
            ...room,
            recipients: updatedRecipients,
            recipients_data: updatedRecipientsData
          };
        }
        return room;
      }));
    }
  };

  const handleRoomMemberRemoveEvent = (data: any) => {
    const roomData = data.data || data;
    const roomId = roomData.room_id;
    const userId = roomData.user_id;
    const recipients = roomData.recipients || [];
    const newCreator = roomData.new_creator;
    const currentUser = user();
    
    if (roomId && userId && currentUser) {
      console.log("[AuthProvider] Member removed from room:", { roomId, userId });
      
      // If the current user was removed, remove the room from their list
      if (userId === currentUser.id) {
        setRooms(prev => prev.filter(room => room.id !== roomId));
        
        // If user is currently viewing the room they were removed from, redirect to home
        const currentLocation = window.location.pathname;
        if (currentLocation.includes(`/rooms/${roomId}`)) {
          window.location.href = '/';
        }
      } else {
        // Update the room's recipients list
        setRooms(prev => prev.map(room => {
          if (room.id === roomId) {
            const updatedRecipients = [...recipients];
            const updatedRecipientsData = updatedRecipients.map((recipientId: string) => {
              const userData = cache.getUser(recipientId);
              return userData ? {
                id: recipientId,
                username: userData.username,
                discriminator: userData.discriminator,
                display_name: userData.display_name || userData.username,
                avatar: userData.avatar,
                presence: userData.presence
              } : null;
            }).filter(Boolean);
            
            return {
              ...room,
              recipients: updatedRecipients,
              recipients_data: updatedRecipientsData,
              owner_id: newCreator || room.owner_id // Update creator if ownership was transferred
            };
          }
          return room;
        }));
      }
    }
  };

  const handleRoomOwnershipTransferEvent = (data: any) => {
    const roomData = data.data || data;
    const roomId = roomData.room_id;
    const oldOwner = roomData.old_owner;
    const newOwner = roomData.new_owner;
    
    if (roomId && newOwner) {
      console.log("[AuthProvider] Room ownership transferred:", { roomId, oldOwner, newOwner });
      
      // Update the room's owner_id
      setRooms(prev => prev.map(room => {
        if (room.id === roomId) {
          return {
            ...room,
            owner_id: newOwner
          };
        }
        return room;
      }));
    }
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
      
      // Remove initial HTML loading screen
      if (window.removeInitialLoadingScreen) {
        window.removeInitialLoadingScreen();
      }
        
        // Remove initial HTML loading screen
        if (window.removeInitialLoadingScreen) {
          window.removeInitialLoadingScreen();
        }
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
      
      // Remove initial HTML loading screen
      if (window.removeInitialLoadingScreen) {
        window.removeInitialLoadingScreen();
      }
    }
  };

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    try {
      setLoading(true);
      const response = await api.auth.register(data);
      
      // Handle email verification case (no token returned)
      if ((response as any).message && !(response as any).token) {
        return { 
          success: true, 
          message: (response as any).message
        };
      }
      
      // Handle immediate login case (token returned)
      if (!response?.token) {
        return { success: false, error: "No token in response" };
      }

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
    
    // Remove initial HTML loading screen
    if (window.removeInitialLoadingScreen) {
      window.removeInitialLoadingScreen();
    }
    
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
              username: userData.username || userData.Username,
              discriminator: userData.discriminator || userData.Discriminator,
              display_name: userData.display_name || userData.DisplayName,
              avatar: userData.avatar || userData.Avatar,
              banner: userData.banner || userData.Banner,
              bio: userData.bio || userData.Bio,
              about_me: userData.about_me || userData.AboutMe,
              presence: (userData.presence || userData.Presence) ? {
                status: (userData.presence?.status || userData.Presence?.Status),
                custom_status: (userData.presence?.custom_status || userData.Presence?.CustomStatus)
              } : undefined
            });
          });
        }
      }
    } catch (error) {
      console.error("Error fetching bulk user data:", error);
    }
  };

  const sendMessage = async (roomId: string, messageData: { content: string; nonce?: string; message_references?: string[]; attachments?: string[] }): Promise<MessageResponse> => {
    try {
      if (!roomId || (!messageData.content.trim() && (!messageData.attachments || messageData.attachments.length === 0))) {
        return { success: false, error: "Room ID and message content or attachments are required" };
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
          
          // Remove initial HTML loading screen
          if (window.removeInitialLoadingScreen) {
            window.removeInitialLoadingScreen();
          }
        });
      } else {
        setLoading(false);
        
        // Remove initial HTML loading screen
        if (window.removeInitialLoadingScreen) {
          window.removeInitialLoadingScreen();
        }
      }
    };
    
    initializeAuth();
  });
  
  // Set up global functions for WebSocketClient to access
  onMount(() => {
    window.getCurrentRooms = () => rooms();
    window.getCurrentUser = () => user();
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
    console.log("[AuthProvider] handleMessageCreateEvent called with data:", data);
    const messageData = data.data || data;
    console.log("[AuthProvider] Extracted messageData:", messageData);
    if (!messageData.room_id || !messageData.id) {
      console.warn("[AuthProvider] Missing room_id or id, skipping message create:", { room_id: messageData.room_id, id: messageData.id });
      return;
    }
    
    const currentUser = user();
    if (!currentUser) return;
    
    // Check if user is currently viewing this room
    const currentLocation = window.location.pathname;
    const isViewingThisRoom = currentLocation.includes(`/rooms/${messageData.room_id}`);
    
    // Check if room has no cached messages before adding this one
    const hadNoMessages = !cache.hasMessages(messageData.room_id);
    
    // Create a normalized message object
    const normalizedMessage = {
      id: messageData.id,
      content: messageData.content || "",
      author_id: messageData.author_id || messageData.sender_id || "",
      room_id: messageData.room_id,
      created_at: messageData.created_at || new Date().toISOString(),
      edited_at: messageData.edited_at || null,
      attachments: messageData.attachments || [],
      message_references: messageData.message_references || [],
      type: messageData.type,
      system: messageData.system,
      system_type: messageData.system_type,
      system_data: messageData.system_data,
    };
    
    // Check if this message is from the current user and has a nonce (indicating it's a confirmation of a sent message)
    const isFromCurrentUser = normalizedMessage.author_id === currentUser.id;
    const messageNonce = messageData.nonce;
    
    console.log("[AuthProvider] Message analysis:", {
      isFromCurrentUser,
      messageNonce,
      hasNonce: !!messageNonce,
      messageId: messageData.id,
      authorId: normalizedMessage.author_id,
      currentUserId: currentUser.id
    });
    
    if (isFromCurrentUser && messageNonce && window.messageCache) {
      // This is a confirmation of a message we sent - update the pending message with real data
      console.log("[AuthProvider] Updating pending message with real data:", { nonce: messageNonce, id: messageData.id });
      window.messageCache.updateMessageByNonce(messageData.room_id, messageNonce, {
        id: messageData.id,
        created_at: messageData.created_at,
        sending: false,
        nonce: messageNonce // Preserve the nonce for deduplication
      });
      
      // Dispatch event to remove from pending messages in ChatArea
      // Use setTimeout to ensure the cache update has been processed
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("pendingMessageConfirmed", {
          detail: {
            roomId: messageData.room_id,
            nonce: messageNonce,
            messageId: messageData.id
          }
        }));
      }, 0);
      
      // Don't dispatch messageCreate for nonce-based confirmations to avoid duplicates
      // The pending message will be converted to a real message via cache update
    } else {
      // This is a message from another user - add it to cache normally
      if (window.messageCache) {
        console.log("[AuthProvider] Adding message to cache:", normalizedMessage);
        window.messageCache.addMessage(messageData.room_id, normalizedMessage);
      }
      
      // If this is from current user but no nonce, dispatch a fallback event
      // This handles cases where the server doesn't return the nonce
      if (isFromCurrentUser) {
        console.log("[AuthProvider] Message from current user but no nonce, dispatching fallback event");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("currentUserMessageReceived", {
            detail: {
              roomId: messageData.room_id,
              messageId: messageData.id,
              content: normalizedMessage.content,
              createdAt: normalizedMessage.created_at
            }
          }));
        }, 0);
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
    }
    
    // If room had no messages before this one, fetch historical messages
    if (hadNoMessages) {
      console.log("[AuthProvider] Room had no cached messages, fetching historical messages for room:", messageData.room_id);
      fetchRoomMessages(messageData.room_id).catch(error => {
        console.error("[AuthProvider] Failed to fetch historical messages:", error);
      });
    }
    
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

  const handleMessageEditEvent = (data: any) => {
    console.log("[AuthProvider] Raw message edit data received:", data);
    // Handle both direct payload and nested data structure
    const messageData = data.payload || data.data || data;
    console.log("[AuthProvider] Extracted messageData:", messageData);
    console.log("[AuthProvider] messageData.room_id:", messageData.room_id);
    console.log("[AuthProvider] messageData.message_id:", messageData.message_id);
    
    if (!messageData.room_id || !messageData.message_id) {
      console.warn("[AuthProvider] Missing room_id or message_id, skipping message edit");
      return;
    }
    
    const currentUser = user();
    if (!currentUser) {
      console.warn("[AuthProvider] No current user, skipping message edit");
      return;
    }
    
    console.log("[AuthProvider] Processing message edit event:", messageData);
    
    // Update message in cache
    if (window.messageCache) {
      console.log("[AuthProvider] Updating message in cache:", {
        roomId: messageData.room_id,
        messageId: messageData.message_id,
        content: messageData.content,
        editedAt: messageData.edited_at
      });
      
      window.messageCache.updateMessage(messageData.room_id, messageData.message_id, {
        content: messageData.content,
        edited_at: messageData.edited_at || new Date().toISOString()
      });
    }
    
    // Dispatch messageEdit event for UI components to listen to
    // This is critical for real-time updates in the ChatArea component
    console.log("[AuthProvider] Dispatching messageEdit event");
    window.dispatchEvent(new CustomEvent("messageEdit", {
      detail: {
        roomId: messageData.room_id,
        messageId: messageData.message_id,
        content: messageData.content,
        editedAt: messageData.edited_at,
        authorId: messageData.author_id
      }
    }));
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

  const fetchRoomMessages = async (roomId: string): Promise<void> => {
    try {
      console.log(`[AuthProvider] Fetching messages for room: ${roomId}`);
      const response = await fetch(`${BASE_URL}/rooms/${roomId}/messages`, {
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      const messages = Array.isArray(data) ? data : 
                      data.messages ? data.messages : 
                      data.success && data.messages ? data.messages : [];
      
      // Extract author data from messages and add to user cache (optimized batch processing)
      if (Array.isArray(messages)) {
        const newUsers = new Map();
        
        // First pass: collect unique authors that aren't already cached
        messages.forEach((message: any) => {
          if (message.author && message.author.id && !cache.getUser(message.author.id) && !newUsers.has(message.author.id)) {
            newUsers.set(message.author.id, {
              id: message.author.id,
              username: message.author.username,
              discriminator: message.author.discriminator,
              display_name: message.author.display_name,
              avatar: message.author.avatar,
              banner: message.author.banner,
              presence: message.author.presence,
              flags: message.author.flags,
              about_me: message.author.about_me,
              bio: message.author.bio
            });
          }
        });
        
        // Batch add new users to cache
        newUsers.forEach((user) => {
          cache.setUser(user);
        });
      }
      
      if (Array.isArray(messages) && messages.length > 0) {
        console.log(`[AuthProvider] Fetched ${messages.length} historical messages for room: ${roomId}`);
        // Add messages to cache using 'older' position to place them before the real-time message
        cache.setMessages(roomId, messages, 'older');
      } else {
        console.log(`[AuthProvider] No historical messages found for room: ${roomId}`);
      }
    } catch (error) {
      console.error(`[AuthProvider] Failed to fetch messages for room ${roomId}:`, error);
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