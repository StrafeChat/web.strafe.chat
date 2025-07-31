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
import { useCache, User } from "../cache/CacheProvider";
import { handleWebSocketMessage } from "../../events";
import { BASE_URL, WS_URL } from "../../../constants";
import { api } from "../../api";
import { RoomWithRecipients } from "../../../types/rooms";
import { Space } from "../cache/CacheProvider";
import { NotificationService } from "../../services/NotificationService";
import { hasUserMention } from "../../utils/mentions";
import { useUserSettings } from "../userSettings/UserSettingsProvider";
import { FS_URL } from "../../../constants";

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
  SPACES: `${BASE_URL}/spaces`,
  SPACE_MEMBERS: (spaceId: string) => `${BASE_URL}/spaces/${spaceId}/members`,
  SPACE_MEMBER_ROLES: (spaceId: string, userId: string) => `${BASE_URL}/spaces/${spaceId}/members/${userId}/roles`,
  SPACE_ROLES: (spaceId: string) => `${BASE_URL}/spaces/${spaceId}/roles`,
  SPACE_INVITES: (spaceId: string) => `${BASE_URL}/spaces/${spaceId}/invites`,
  GET_INVITE_INFO: (code: string) => `${BASE_URL}/invite/${code}`,
  USE_INVITE: (code: string) => `${BASE_URL}/invite/${code}/use`,
  BOTS: `${BASE_URL}/bots`,

};

export const API_HEADERS = {
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
  created_at?: string;
  updated_at?: string;
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
  spaces: () => Space[];
  setSpaces: (spaces: Space[] | ((prev: Space[]) => Space[])) => void;
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
  mentionUnreadMessages: () => { [roomId: string]: string[] };
  setMentionUnreadMessages: (unreads: { [roomId: string]: string[] } | ((prev: { [roomId: string]: string[] }) => { [roomId: string]: string[] })) => void;
  fetchUnreadMessages: (roomId: string) => Promise<void>;
  markMessagesAsRead: (roomId: string) => Promise<void>;
	getJoinToken: (roomId: string) => Promise<string>;
	getRoomParticipants: (roomId: string) => Promise<(User | null)[]>;
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
  const { setUser: setCacheUser, setRoom, setCachedSpaceMembers, setCachedSpaceRoles, getUser, getSpaceMember, updateCachedSpaceMember, removeSpaceMember, addSpaceMember, setUsers, hasMessages, setMessages } = useCache();
  const [user, setUser] = createSignal<Clientuser | null>(null);
  const [relationships, setRelationships] = createSignal<string[]>([]);
  const [relationshipRequests, setRelationshipRequests] = createSignal<Relationship[]>([]);
  const [rooms, setRooms] = createSignal<RoomWithRecipients[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [isMobile, setIsMobile] = createSignal(window.innerWidth <= 768);
  const [wsClient, setWsClient] = createSignal<WebSocketClient | null>(null);
  const [unreadMessages, setUnreadMessages] = createSignal<{ [roomId: string]: string[] }>({});
  const [mentionUnreadMessages, setMentionUnreadMessages] = createSignal<{ [roomId: string]: string[] }>({});
  
  // Get notification service and user settings
  const notificationService = NotificationService.getInstance();
  const userSettings = useUserSettings();

  const mobileCheck = createMemo(() => isMobile());

  // Handle window resize for mobile detection
  createEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Cache rooms when they are updated
  createEffect(() => {
    const currentRooms = rooms();
    if (currentRooms && currentRooms.length > 0) {
      console.log("[AuthProvider] Caching", currentRooms.length, "rooms");
      currentRooms.forEach(room => {
        setRoom({
          ...room,
          updated_at: room.updated_at || undefined
        });
      });
    }
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
    client.onMessage("ROOM_POSITIONS_UPDATE", handleRoomPositionsUpdateEvent);
    client.onMessage("ROOM_MEMBER_ADD", handleRoomMemberAddEvent);
    client.onMessage("ROOM_MEMBER_REMOVE", handleRoomMemberRemoveEvent);
    client.onMessage("ROOM_OWNERSHIP_TRANSFER", handleRoomOwnershipTransferEvent);
    client.onMessage("SPACE_CREATE", handleSpaceCreateEvent);
    client.onMessage("SPACE_UPDATE", handleSpaceUpdateEvent);
    client.onMessage("SPACE_INVITE_CREATE", handleSpaceInviteCreateEvent);
    client.onMessage("SPACE_INVITE_DELETE", handleSpaceInviteDeleteEvent);
    client.onMessage("SPACE_INVITE_UPDATE", handleSpaceInviteUpdateEvent);
    client.onMessage("SPACE_MEMBER_ROLE_UPDATE", handleSpaceMemberRoleUpdateEvent);
    client.onMessage("SPACE_MEMBER_REMOVE", handleSpaceMemberRemoveEvent);
    client.onMessage("SPACE_MEMBER_ADD", handleSpaceMemberAddEvent);
    client.onMessage("presence", handlePresenceEvent);
    console.log("[AuthProvider] Registering MESSAGE_CREATE handler");
    client.onMessage("MESSAGE_CREATE", handleMessageCreateEvent);
    console.log("[AuthProvider] Registering MESSAGE_EDIT handler");
    client.onMessage("MESSAGE_EDIT", handleMessageEditEvent);
  };
	
  const handleReadyEvent = (data: any) => {
    console.log("[AuthProvider] READY event received:", data);
    
    if (data.client_user) {
      const userData = normalizeUserData(data.client_user);
      setUser(userData);
      setIsAuthenticated(true);
      setCacheUser(userData);
    }

    if (data.users) {
      setUsers(data.users);
    }

    if (data.relationships) {
      setRelationships(data.relationships);
      // Dispatch event to CacheProvider
      window.dispatchEvent(new CustomEvent('relationshipUpdate', {
        detail: { relationships: data.relationships }
      }));
    }

    if (data.relationship_requests) {
      const requests = normalizeRelationshipRequests(data.relationship_requests);
      setRelationshipRequests(requests);
      // Dispatch event to CacheProvider
      window.dispatchEvent(new CustomEvent('relationshipUpdate', {
        detail: { relationshipRequests: requests }
      }));
    }

    if (data.rooms) {
      console.log("[AuthProvider] Raw rooms from READY:", data.rooms);
      console.log("[AuthProvider] Number of rooms:", Array.isArray(data.rooms) ? data.rooms.length : Object.keys(data.rooms).length);
      const roomsData = normalizeRoomsData(data.rooms, data.users);
      setRooms(roomsData);
      // Dispatch event to CacheProvider
      window.dispatchEvent(new CustomEvent('roomsCache', {
        detail: roomsData
      }));
    } else {
      console.log("[AuthProvider] No rooms data in READY event");
    }

    if (data.spaces) {
      const spacesData = data.spaces.map((space: any) => {
        const spaceId = String(space.id || space.ID);
        
        // Cache space members if they exist in the space object
        if (space.members && Array.isArray(space.members)) {
          console.log(`[AuthProvider] Caching ${space.members.length} members for space ${spaceId}`);
          const normalizedMembers = space.members.map((member: any) => ({
            space_id: member.space_id || member.SpaceID || spaceId,
            user_id: member.user_id || member.UserID,
            nick: member.nick || member.Nick,
            avatar: member.avatar || member.Avatar,
            roles: member.roles || member.Roles || [],
            joined_at: member.joined_at || member.JoinedAt,
            deaf: member.deaf || member.Deaf || false,
            mute: member.mute || member.Mute || false,
            flags: member.flags || member.Flags || 0,
            pending: member.pending || member.Pending || false,
            user: member.user || member.User || {
              id: member.user_id || member.UserID,
              username: member.user?.username || member.User?.Username || '',
              display_name: member.user?.display_name || member.User?.DisplayName || member.user?.username || member.User?.Username || '',
              discriminator: member.user?.discriminator || member.User?.Discriminator || 0,
              avatar: member.user?.avatar || member.User?.Avatar || '',
              banner: member.user?.banner || member.User?.Banner || '',
              bot: member.user?.bot || member.User?.Bot || false,
              system: member.user?.system || member.User?.System || false,
              bio: member.user?.bio || member.User?.Bio || '',
              about_me: member.user?.about_me || member.User?.AboutMe || '',
              flags: member.user?.flags || member.User?.Flags || 0,
              presence: member.user?.presence || member.User?.Presence || {
                status: 'offline',
                custom_status: ''
              }
            }
          }));
          setCachedSpaceMembers(spaceId, normalizedMembers);
        }
        
        // Cache space roles if they exist in the space object
        if (space.roles && Array.isArray(space.roles)) {
          console.log(`[AuthProvider] Caching ${space.roles.length} roles for space ${spaceId}`);
          const normalizedRoles = space.roles.map((role: any) => ({
            space_id: role.space_id || role.SpaceID || spaceId,
            role_id: role.role_id || role.RoleID,
            name: role.name || role.Name,
            color: role.color || role.Color,
            permissions: role.permissions || role.Permissions || [],
            position: role.position || role.Position || 0,
            mentionable: role.mentionable || role.Mentionable || false,
            hoist: role.hoist || role.Hoist || false,
            created_at: role.created_at || role.CreatedAt,
            updated_at: role.updated_at || role.UpdatedAt
          }));
          setCachedSpaceRoles(spaceId, normalizedRoles);
        }
        
        return {
          id: spaceId,
          name: space.name || space.Name || "",
          name_acronym: space.name_acronym || space.NameAcronym || "",
          description: space.description || space.Description,
          icon: space.icon || space.Icon,
          banner: space.banner || space.Banner,
          owner_id: space.owner_id || space.OwnerID || "",
          verification_level: space.verification_level || space.VerificationLevel || 0,
          default_message_notifications: space.default_message_notifications || space.DefaultMessageNotifications || 0,
          explicit_content_filter: space.explicit_content_filter || space.ExplicitContentFilter || 0,
          features: space.features || space.Features || [],
          afk_room_id: space.afk_room_id || space.AfkRoomID,
          afk_timeout: space.afk_timeout || space.AfkTimeout || 0,
          system_room_id: space.system_room_id || space.SystemRoomID,
          system_room_flags: space.system_room_flags || space.SystemRoomFlags || 0,
          rules_room_id: space.rules_room_id || space.RulesRoomID,
          max_presences: space.max_presences || space.MaxPresences,
          max_members: space.max_members || space.MaxMembers,
          vanity_url_code: space.vanity_url_code || space.VanityUrlCode,
          preferred_locale: space.preferred_locale || space.PreferredLocale || "en-US",
          public_updates_room_id: space.public_updates_room_id || space.PublicUpdatesRoomID,
          max_video_room_users: space.max_video_room_users || space.MaxVideoRoomUsers,
          nsfw_level: space.nsfw_level || space.NsfwLevel || 0,
          created_at: space.created_at || space.CreatedAt || new Date().toISOString(),
          updated_at: space.updated_at || space.UpdatedAt || new Date().toISOString()
        };
      });
      setSpaces(spacesData);
    }

    // Handle unread messages from READY event
    if (data.unread_messages) {
      setUnreadMessages(data.unread_messages);
    }
    
    // Handle mention unread messages from READY event
    if (data.mention_unread_messages) {
      setMentionUnreadMessages(data.mention_unread_messages);
    }
    
    // Update room unread counts based on unread messages
    if (data.rooms && (data.unread_messages || data.mention_unread_messages)) {
      setRooms(rooms => {
        return rooms.map(room => {
          const roomUnreads = data.unread_messages?.[room.id] || [];
          const roomMentionUnreads = data.mention_unread_messages?.[room.id] || [];
          return {
            ...room,
            unread_count: roomUnreads.length,
            mention_count: roomMentionUnreads.length
          };
        });
      });
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
    created_at: userData.created_at || userData.CreatedAt,
    updated_at: userData.updated_at || userData.UpdatedAt,
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

  const normalizeRoomsData = (rooms: any, users: any): RoomWithRecipients[] => {
    console.log("[AuthProvider] Raw rooms data:", rooms);
    const roomsArray = Array.isArray(rooms) ? rooms : Object.values(rooms);
    const normalizedRooms = roomsArray.map((room: any) => {
      const spaceId = room.SpaceID || room.space_id;
      const parentId = room.ParentID || room.parent_id;
      console.log(`[AuthProvider] Room ${room.ID || room.id}: space_id=${spaceId}, parent_id=${parentId}, type=${room.Type || room.type}`);
      
      return {
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
        permission_overrides: room.permission_overrides,
        space_id: spaceId ? String(spaceId) : undefined,
        parent_id: parentId ? String(parentId) : undefined,
        position: room.Position ?? room.position ?? undefined,
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
      };
    });
    
    console.log("[AuthProvider] Normalized rooms:", normalizedRooms);
    return normalizedRooms;
  };

  const handleRelationshipEvent = (data: any) => {
    const cacheObject = {
      users: () => ({}), // Not used in relationship events
      getUser,
      setUser: setCacheUser
    };
    handleWebSocketMessage(
      { type: data.type, ...data },
      cacheObject,
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
    const roomData = data.room || data.data || data;
    console.log("[AuthProvider] Room create event received:", roomData);
    
    // Debug space_id precision issue
    const rawSpaceId = roomData.space_id || roomData.SpaceID;
    console.log("[AuthProvider] Raw space_id from room create event:", {
      raw_value: rawSpaceId,
      type: typeof rawSpaceId,
      string_converted: String(rawSpaceId)
    });
    
    const newRoom = {
      id: roomData.id || roomData.ID,
      name: roomData.name || roomData.Name || "",
      type: roomData.type || roomData.Type || 0,
      recipients: roomData.recipients || roomData.Recipients || [],
      owner_id: roomData.creator || roomData.Creator || roomData.owner_id || roomData.OwnerID || "",
      last_message_id: roomData.last_message_id || roomData.LastMessageID || null,
      icon: roomData.icon || roomData.Icon || null,
      topic: roomData.topic || roomData.Topic || "",
      created_at: roomData.created_at || roomData.CreatedAt || new Date().toISOString(),
      updated_at: roomData.updated_at || roomData.UpdatedAt || null,
      space_id: rawSpaceId ? String(rawSpaceId) : undefined,
      parent_id: roomData.parent_id || roomData.ParentID ? String(roomData.parent_id || roomData.ParentID) : undefined,
      position: roomData.position || roomData.Position || undefined,
      recipients_data: (roomData.recipients || roomData.Recipients || [])?.map((recipientId: string) => {
        const userData = getUser(recipientId);
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
    
    console.log("[AuthProvider] Adding new room:", newRoom);
    setRooms(prev => [...prev, newRoom as RoomWithRecipients]);
    
    // Cache the new room immediately
    setRoom(newRoom);
    
    // Dispatch event to CacheProvider
    window.dispatchEvent(new CustomEvent('roomCreate', {
      detail: newRoom
    }));
  };

  const handleRoomDeleteEvent = (data: any) => {
    const roomData = data.data || data;
    const roomId = roomData.room_id;
    
    if (roomId) {
      console.log("[AuthProvider] Room deleted:", roomId);
      setRooms(prev => prev.filter(room => room.id !== roomId));
      
      // Dispatch event to CacheProvider
      window.dispatchEvent(new CustomEvent('roomDelete', {
        detail: { roomId }
      }));
      
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
          
          // Cache the updated room
          setRoom({
            ...updatedRoom,
            updated_at: updatedRoom.updated_at || undefined
          });
          
          // Dispatch event to CacheProvider
          window.dispatchEvent(new CustomEvent('roomUpdate', {
            detail: updatedRoom
          }));
          
          return updatedRoom;
        }
        return room;
      }));
    }
  };

  const handleRoomPositionsUpdateEvent = (data: any) => {
    const eventData = data.data || data;
    const roomPositions = eventData.room_positions;
    
    if (roomPositions && Array.isArray(roomPositions)) {
      console.log("[AuthProvider] Room positions updated:", roomPositions);
      
      setRooms(prev => {
        const updated = prev.map(room => {
          const positionUpdate = roomPositions.find((pos: any) => pos.room_id === room.id);
          if (positionUpdate) {
            const updatedRoom = {
              ...room,
              position: positionUpdate.position
            };
            
            // Update parent_id if it's provided in the update
            if (positionUpdate.hasOwnProperty('parent_id')) {
              updatedRoom.parent_id = positionUpdate.parent_id;
              console.log(`[AuthProvider] Updated room ${room.id} parent_id from ${room.parent_id} to ${positionUpdate.parent_id}`);
            }
            
            console.log(`[AuthProvider] Updated room ${room.id} position from ${room.position} to ${positionUpdate.position}`);
            return updatedRoom;
          }
          return room;
        });
        
        console.log("[AuthProvider] Rooms after update:", updated.filter(r => roomPositions.some((pos: any) => pos.room_id === r.id)));
        return updated;
      });
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
            const userData = getUser(recipientId);
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
              const userData = getUser(recipientId);
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

  const handleSpaceCreateEvent = (data: any) => {
    const spaceData = data.data || data;
    console.log("[AuthProvider] Space created:", spaceData);
    
    // Add space to spaces signal
    // Ensure space ID is handled as string from the start to avoid precision issues
    const spaceId = String(spaceData.id || spaceData.ID);
    console.log(`[AuthProvider] Creating space with ID:`, {
      raw_id: spaceData.id || spaceData.ID,
      string_id: spaceId,
      type_of_raw: typeof (spaceData.id || spaceData.ID)
    });
    
    const newSpace: Space = {
      id: spaceId,
      name: spaceData.name || spaceData.Name || "",
      name_acronym: spaceData.name_acronym || spaceData.NameAcronym || "",
      description: spaceData.description || spaceData.Description,
      icon: spaceData.icon || spaceData.Icon,
      banner: spaceData.banner || spaceData.Banner,
      owner_id: spaceData.owner_id || spaceData.OwnerID || "",
      verification_level: spaceData.verification_level || spaceData.VerificationLevel || 0,
      default_message_notifications: spaceData.default_message_notifications || spaceData.DefaultMessageNotifications || 0,
      explicit_content_filter: spaceData.explicit_content_filter || spaceData.ExplicitContentFilter || 0,
      features: spaceData.features || spaceData.Features || [],
      afk_room_id: spaceData.afk_room_id || spaceData.AfkRoomID,
      afk_timeout: spaceData.afk_timeout || spaceData.AfkTimeout || 0,
      system_room_id: spaceData.system_room_id || spaceData.SystemRoomID,
      system_room_flags: spaceData.system_room_flags || spaceData.SystemRoomFlags || 0,
      rules_room_id: spaceData.rules_room_id || spaceData.RulesRoomID,
      max_presences: spaceData.max_presences || spaceData.MaxPresences,
      max_members: spaceData.max_members || spaceData.MaxMembers,
      vanity_url_code: spaceData.vanity_url_code || spaceData.VanityUrlCode,
      preferred_locale: spaceData.preferred_locale || spaceData.PreferredLocale || "en-US",
      public_updates_room_id: spaceData.public_updates_room_id || spaceData.PublicUpdatesRoomID,
      max_video_room_users: spaceData.max_video_room_users || spaceData.MaxVideoRoomUsers,
      nsfw_level: spaceData.nsfw_level || spaceData.NsfwLevel || 0,
      created_at: spaceData.created_at || spaceData.CreatedAt || new Date().toISOString(),
      updated_at: spaceData.updated_at || spaceData.UpdatedAt || new Date().toISOString()
    };
    setSpaces(prev => [...prev, newSpace]);
    
    // Also dispatch the event for the CacheProvider to handle
    window.dispatchEvent(new CustomEvent('spaceCreate', { detail: newSpace }));
    
    // Handle rooms if they exist in the space creation event
    if (spaceData.rooms && Array.isArray(spaceData.rooms)) {
      console.log(`[AuthProvider] Processing ${spaceData.rooms.length} rooms for space ${spaceId}`);
      console.log(`[AuthProvider] Raw rooms data:`, spaceData.rooms);
      
      spaceData.rooms.forEach((room: any, index: number) => {
        console.log(`[AuthProvider] Processing room ${index + 1}:`, {
          raw_room: room,
          id: room.id || room.ID,
          name: room.name || room.Name,
          type: room.type || room.Type,
          space_id: room.space_id || room.SpaceID || spaceData.id,
          parent_id: room.parent_id || room.ParentID,
          position: room.position || room.Position
        });
        
        const roomData = {
          id: room.id || room.ID,
          name: room.name || room.Name || "",
          type: room.type || room.Type || 0,
          recipients: room.recipients || room.Recipients || [],
          owner_id: room.creator || room.Creator || room.owner_id || room.OwnerID || "",
          last_message_id: room.last_message_id || room.LastMessageID || null,
          icon: room.icon || room.Icon || null,
          topic: room.topic || room.Topic || "",
          created_at: room.created_at || room.CreatedAt || new Date().toISOString(),
          updated_at: room.updated_at || room.UpdatedAt || null,
          space_id: (() => {
            const rawSpaceId = room.space_id || room.SpaceID || spaceId;
            const stringSpaceId = String(rawSpaceId);
            console.log(`[AuthProvider] Room space_id conversion:`, {
              raw_space_id: rawSpaceId,
              string_space_id: stringSpaceId,
              consistent_space_id: spaceId,
              type_of_raw: typeof rawSpaceId
            });
            return stringSpaceId;
          })(),
          parent_id: room.parent_id || room.ParentID ? String(room.parent_id || room.ParentID) : undefined,
          position: room.position || room.Position || undefined,
          recipients_data: (room.recipients || room.Recipients || [])?.map((recipientId: string) => {
            const userData = getUser(recipientId);
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
        
        console.log(`[AuthProvider] Final roomData for dispatch:`, {
          id: roomData.id,
          name: roomData.name,
          type: roomData.type,
          space_id: roomData.space_id,
          parent_id: roomData.parent_id,
          position: roomData.position,
          type_matches_expected: [0, 1, 2, 3, 4].includes(roomData.type)
        });
        
        // Add room to local state
        setRooms(prev => [...prev, roomData as RoomWithRecipients]);
        
        // Cache the new room immediately
        setRoom(roomData);
        
        // Dispatch event to CacheProvider
        window.dispatchEvent(new CustomEvent('roomCreate', {
          detail: roomData
        }));
      });
    }
    
    // Handle members if they exist in the space creation event
    if (spaceData.members && Array.isArray(spaceData.members)) {
      console.log(`[AuthProvider] Processing ${spaceData.members.length} members for space ${spaceId}`);
      window.dispatchEvent(new CustomEvent('spaceMembersCache', {
        detail: {
          spaceId: spaceId,
          members: spaceData.members.map((member: any) => ({
            space_id: member.space_id || spaceId,
            user_id: member.user_id,
            joined_at: member.joined_at,
            deaf: member.deaf || false,
            mute: member.mute || false,
            flags: member.flags || 0,
            pending: member.pending || false
          }))
        }
      }));
    }
  };

  const handleSpaceUpdateEvent = (data: any) => {
    const spaceData = data.data || data;
    // Extract space_id from the top level of the payload (as per backend structure)
    const spaceId = String(data.space_id || data.id || '');
    console.log("[AuthProvider] Space updated:", spaceData, "for space ID:", spaceId);
    console.log("[AuthProvider] Full payload structure:", data);
    console.log("[AuthProvider] Extracted space_id:", spaceId);
    console.log("[AuthProvider] Available keys in data:", Object.keys(data));
    
    if (spaceId) {
      // Update the space in the spaces signal
      setSpaces(prev => prev.map(space => {
        if (String(space.id) === spaceId) {
          const updatedSpace = { ...space };
          
          // Update only the fields that are provided in the update
          if (spaceData.name !== undefined) {
            updatedSpace.name = spaceData.name;
          }
          if (spaceData.description !== undefined) {
            updatedSpace.description = spaceData.description;
          }
          if (spaceData.icon !== undefined) {
            updatedSpace.icon = spaceData.icon;
          }
          if (spaceData.banner !== undefined) {
            updatedSpace.banner = spaceData.banner;
          }
          
          // Always update the updated_at timestamp
          updatedSpace.updated_at = new Date().toISOString();
          
          console.log("[AuthProvider] Updated space:", updatedSpace);
          return updatedSpace;
        }
        return space;
      }));
      
      // Also dispatch the event for the CacheProvider to handle
      const updatedSpaceForEvent = {
        id: spaceId,
        ...spaceData
      };
      window.dispatchEvent(new CustomEvent('spaceUpdate', { detail: updatedSpaceForEvent }));
    }
  };

  const handleSpaceInviteCreateEvent = (data: any) => {
    const inviteData = data.data || data;
    console.log("[AuthProvider] Space invite created:", inviteData);
    
    // Dispatch event for components to handle
    window.dispatchEvent(new CustomEvent('spaceInviteCreate', { detail: inviteData }));
  };

  const handleSpaceInviteDeleteEvent = (data: any) => {
    const inviteData = data.data || data;
    console.log("[AuthProvider] Space invite deleted:", inviteData);
    
    // Dispatch event for components to handle
    window.dispatchEvent(new CustomEvent('spaceInviteDelete', { detail: inviteData }));
  };

  const handleSpaceInviteUpdateEvent = (data: any) => {
    const inviteData = data.data || data;
    console.log("[AuthProvider] Space invite updated:", inviteData);
    
    // Dispatch event for components to handle
    window.dispatchEvent(new CustomEvent('spaceInviteUpdate', { detail: inviteData }));
  };

  const handleSpaceMemberRoleUpdateEvent = (eventData: any) => {
    console.log("[AuthProvider] Space member role updated:", eventData);
    
    const spaceId = String(eventData.space_id);
    const userId = String(eventData.user_id);
    const roles = eventData.data?.roles || [];
    
    if (spaceId && userId && roles.length > 0) {
      // Get current member from cache
      const currentMember = getSpaceMember(spaceId, userId);
      if (currentMember) {
        // Update member with new roles
        const updatedMember = {
          ...currentMember,
          roles
        };
        
        // Update cache
        updateCachedSpaceMember(spaceId, updatedMember);
        
        // Dispatch event for components to handle real-time updates
        window.dispatchEvent(new CustomEvent('spaceMemberRoleUpdate', { 
          detail: {
            spaceId,
            userId,
            member: updatedMember,
            roles
          }
        }));
      }
    }
  };

  const handleSpaceMemberRemoveEvent = (eventData: any) => {
    console.log("[AuthProvider] Space member remove event:", eventData);
    
    const spaceId = String(eventData.space_id || eventData.data?.space_id);
    const userId = String(eventData.user_id || eventData.data?.user_id);
    const currentUserId = user()?.id;
    
    if (spaceId && userId) {
      // If the current user is being removed from the space, remove it from their spaces array
      if (userId === currentUserId) {
        console.log("[AuthProvider] Current user removed from space:", spaceId);
        setSpaces(currentSpaces => {
          const updatedSpaces = currentSpaces.filter(space => space.id !== spaceId);
          console.log("[AuthProvider] Updated spaces after removal:", updatedSpaces.map(s => s.id));
          return updatedSpaces;
        });
        
        // Remove space from cache
        removeSpaceMember(spaceId, userId);
        
        // Dispatch event for real-time UI updates
        window.dispatchEvent(new CustomEvent('spaceRemove', { 
          detail: {
            spaceId,
            userId
          }
        }));
      } else {
        // Another user is being removed, just remove them from the space member cache
        removeSpaceMember(spaceId, userId);
        
        // Dispatch event for components to handle member removal
        window.dispatchEvent(new CustomEvent('spaceMemberRemove', { 
          detail: {
            spaceId,
            userId
          }
        }));
      }
    }
  };

  const handleSpaceMemberAddEvent = (eventData: any) => {
    console.log("[AuthProvider] Space member add event:", eventData);
    
    const spaceId = String(eventData.space_id || eventData.data?.space_id);
    const userId = String(eventData.user_id || eventData.data?.user_id);
    const roles = eventData.roles || eventData.data?.roles || [];
    
    if (spaceId && userId) {
      // Add the user to the space member cache
      addSpaceMember(spaceId, {
        user_id: userId,
        roles: roles,
        joined_at: new Date().toISOString(),
        deaf: false,
        mute: false,
        flags: 0,
        pending: false
      });
      
      // Dispatch event for components to handle member addition
      window.dispatchEvent(new CustomEvent('spaceMemberAdd', { 
        detail: {
          spaceId,
          userId,
          roles
        }
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
      setCacheUser({
        ...currentUser,
        presence
      });
    } else {
      const cachedUser = getUser(data.user_id);
      if (cachedUser) {
        setCacheUser({
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
    setCacheUser(updatedUser);
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
      setCacheUser(updatedUser);
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
            setCacheUser({
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

      let processedMessageData = { ...messageData };

      const response = await fetch(API_ENDPOINTS.ROOM_MESSAGES(roomId), {
        method: "POST",
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify(processedMessageData),
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
      if (!roomId || !content.trim()) {
        return { success: false, error: "Room ID and message content are required" };
      }

      let processedContent = content;

      const response = await fetch(`${API_ENDPOINTS.ROOM_MESSAGES(roomId)}/${messageId}`, {
        method: "PATCH",
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify({ content: processedContent }),
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
  const handleMessageCreateEvent = async (data: any) => {
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
    const hadNoMessages = !hasMessages(messageData.room_id);
    
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
    
    // Update room last_message_id for all messages
    setRooms((rooms: RoomWithRecipients[]) => {
      return rooms.map(room => {
        if (room.id === messageData.room_id) {
          return {
            ...room,
            last_message_id: messageData.id
          };
        }
        return room;
      });
    });
    
    // Handle notifications for messages from other users
    if (!isFromCurrentUser) {
      try {
        const currentRoom = rooms().find(room => room.id === messageData.room_id);
        const messageAuthor = getUser(normalizedMessage.author_id);
        
        // Check if this is a mention
        const isMention = hasUserMention(normalizedMessage.content, currentUser.id);
        
        // Update unread messages state
        setUnreadMessages(prev => ({
          ...prev,
          [messageData.room_id]: [...(prev[messageData.room_id] || []), messageData.id]
        }));
        
        // If this is a mention, also update mention unread messages state
        if (isMention) {
          setMentionUnreadMessages(prev => ({
            ...prev,
            [messageData.room_id]: [...(prev[messageData.room_id] || []), messageData.id]
          }));
        }
        
        // Update room unread count and mention count for messages from other users
        setRooms((rooms: RoomWithRecipients[]) => {
          return rooms.map(room => {
            if (room.id === messageData.room_id) {
              const updatedRoom = {
                ...room,
                unread_count: (room.unread_count || 0) + 1
              };
              
              // If this is a mention, also increment mention_count
              if (isMention) {
                updatedRoom.mention_count = (room.mention_count || 0) + 1;
              }
              
              return updatedRoom;
            }
            return room;
          });
        });
        
        // Check if this is a PM (room type 1 or has recipients)
        const isDM = currentRoom?.type === 1 || (currentRoom?.recipients && currentRoom.recipients.length > 0);
        
        // Create notification data with user avatar
        const getAvatarUrl = (user: any) => {
          if (!user) {
            console.log('[AuthProvider] No user provided for avatar, using favicon');
            return '/favicon.ico';
          }
          const avatarPath = user.bot ? 'bot_avatars' : 'avatars';
          let avatarUrl;
          if (user.avatar) {
            avatarUrl = `${FS_URL}/${avatarPath}/${user.id}/${user.avatar}`;
          } else {
            avatarUrl = `${FS_URL}/${avatarPath}/${user.id}/default.webp`;
          }
          console.log('[AuthProvider] Generated avatar URL for notification:', avatarUrl, 'for user:', user);
          return avatarUrl;
        };
        
        const notificationData = {
          type: isMention ? 'mention' as const : (isDM ? 'pm' as const : 'message' as const),
          title: isDM 
            ? `${messageAuthor?.display_name || messageAuthor?.username || 'Unknown User'}`
            : `${messageAuthor?.display_name || messageAuthor?.username || 'Unknown User'} in ${currentRoom?.name || 'Unknown Room'}`,
          body: normalizedMessage.content || 'New message',
          icon: getAvatarUrl(messageAuthor),
          roomId: messageData.room_id,
          spaceId: currentRoom?.space_id,
          userId: normalizedMessage.author_id,
          url: `/rooms/${messageData.room_id}`,
          isMention,
          isDM
        };
        
        // Get user settings and presence
        const notifications = userSettings.notifications();
        const userPresence = currentUser.presence;
        
        // Send notification
        await notificationService.notify(notificationData, notifications, {
          status: (userPresence?.status || "offline") as "offline" | "online" | "dnd" | "idle",
        });
        
      } catch (error) {
        console.error('[AuthProvider] Failed to send notification:', error);
      }
    }
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
      
      // Clear mention unread messages for this room
      setMentionUnreadMessages((prev: { [roomId: string]: string[] }) => {
        const updated = { ...prev };
        delete updated[roomId];
        return updated;
      });

      // Also update the room's unread_count and mention_count to 0
      setRooms((rooms: RoomWithRecipients[]) => {
        return rooms.map((room: RoomWithRecipients) => {
          if (room.id === roomId) {
            return {
              ...room,
              unread_count: 0,
              mention_count: 0
            };
          }
          return room;
        });
      });

    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

	const getJoinToken = async (roomId: string): Promise<string> => {
		try {
			const response = await fetch(`${BASE_URL}/rooms/join/${roomId}`, {
				headers: {
					...API_HEADERS.JSON,
					...API_HEADERS.SESSION(),
				},
				method: "POST"
			})

			if (!response.ok) {
				throw new Error(`Failed to get join token for room ${roomId}: ${response.status}`);
			}

			const data = await response.json();

			return data.token;
		} catch(error) {
			console.error(`[AuthProvider] Failed to get join token: `, error);
			return "";
		}
	}

	const getRoomParticipants = async (roomId: string): Promise<(User | null)[]> => {
		try {
			const response = await fetch(`${BASE_URL}/rooms/${roomId}/participants`, {
				headers: {
					...API_HEADERS.JSON,
					...API_HEADERS.SESSION(),
				},
				method: "POST"
			})

			if (!response.ok) {
				throw new Error(`Failed to fetch participants for room ${roomId}: ${response.status}`);
			}

			const data = await response.json();

			return data.participants.map((p: string) => getUser(p));
		} catch (error) {
			console.error(`[AuthProvider] Failed to fetch participants: `, error);
			return [];
		}
	}

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
          if (message.author && message.author.id && !getUser(message.author.id) && !newUsers.has(message.author.id)) {
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
          setCacheUser(user);
        });
      }
      
      if (Array.isArray(messages) && messages.length > 0) {
        console.log(`[AuthProvider] Fetched ${messages.length} historical messages for room: ${roomId}`);
        // Add messages to cache using 'older' position to place them before the real-time message
        setMessages(roomId, messages, 'older');
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
        spaces: () => spaces(),
        setSpaces,
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
        mentionUnreadMessages: () => mentionUnreadMessages(),
        setMentionUnreadMessages,
        fetchUnreadMessages,
        markMessagesAsRead,
        sendTypingIndicator,
				getJoinToken,
				getRoomParticipants,
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