import {
  ParentComponent,
  createContext,
  useContext,
  createSignal,
  createEffect,
} from "solid-js";
import { MessageCache, CachedMessage } from "../../cache/MessageCache";
import { SpaceCache, Space, SpaceMember, SpaceRole } from "../../cache/SpaceCache";
import { RoomCache } from "../../cache/RoomCache";
import { InviteCache } from "./InviteCache";
import { InviteInfo } from "../../../types/api";
import { RoomWithRecipients, Room } from "../../../types/rooms";
import { Relationship } from "../../../types/relationships";
import { VoiceUpdateData } from "../../events/voice/update";

export type Presence = {
  status: string;
  custom_status: string;
};

export type User = {
  id: string;
  username: string;
  discriminator: string;
  display_name?: string;
  avatar?: string;
  banner?: string;
  badges?: string[];
  bot?: boolean;
  system?: boolean;
  bio?: string;
  flags?: number;
  about_me?: string;
  presence?: Presence;
  created_at?: string;
  updated_at?: string;
};

type CacheContextType = {
  // User management
  users: () => Record<string, User>;
  getUser: (id: string) => User | undefined;
  setUser: (user: Partial<User> & { id: string }) => void;
  setUsers: (usersData: Record<string, any>) => void;
  // Room management
  rooms: () => RoomWithRecipients[];
  setRooms: (rooms: RoomWithRecipients[] | ((prev: RoomWithRecipients[]) => RoomWithRecipients[])) => void;
  // Relationship management
  relationships: () => string[];
  setRelationships: (relationships: string[]) => void;
  relationshipRequests: () => Relationship[];
  setRelationshipRequests: (requests: Relationship[]) => void;
  // Message management
  getMessages: (roomId: string) => CachedMessage[];
  getMessage: (roomId: string, messageId: string) => CachedMessage | undefined;
  getMessageCount: (roomId: string) => number;
  setMessages: (roomId: string, messages: CachedMessage[], position?: 'newer' | 'older' | 'replace') => void;
  addMessage: (roomId: string, message: CachedMessage) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<CachedMessage>) => void;
  updateMessageByNonce: (roomId: string, nonce: string, updates: Partial<CachedMessage>) => void;
  deleteMessage: (roomId: string, messageId: string) => void;
  hasMessages: (roomId: string) => boolean;
  getOldestMessageId: (roomId: string) => string | undefined;
  getNewestMessageId: (roomId: string) => string | undefined;
  hasReachedBeginning: (roomId: string) => boolean;
  hasReachedEnd: (roomId: string) => boolean;
  setHasReachedBeginning: (roomId: string, reached: boolean) => void;
  setHasReachedEnd: (roomId: string, reached: boolean) => void;
  resetReachedFlags: (roomId: string) => void;
  getLastFetchTime: (roomId: string) => number | undefined;
  // Space management
  spaces: () => Space[];
  getSpace: (spaceId: string) => Space | undefined;
  setSpace: (space: Space) => void;
  getUserSpaces: (userId: string) => Space[];
  getSpaceMembers: (spaceId: string) => SpaceMember[];
  getSpaceMember: (spaceId: string, userId: string) => SpaceMember | undefined;
  setSpaceMember: (spaceMember: SpaceMember) => void;
  addSpaceMember: (spaceId: string, memberData: Partial<SpaceMember> & { user_id: string }) => void;
  removeSpaceMember: (spaceId: string, userId: string) => void;
  deleteSpace: (spaceId: string) => void;
  // Space members cache
  getCachedSpaceMembers: (spaceId: string) => SpaceMember[] | null;
  setCachedSpaceMembers: (spaceId: string, members: SpaceMember[]) => void;
  updateCachedSpaceMember: (spaceId: string, member: SpaceMember) => void;
  // Space roles
  getSpaceRoles: (spaceId: string) => SpaceRole[];
  getSpaceRole: (spaceId: string, roleId: string) => SpaceRole | undefined;
  setSpaceRole: (spaceId: string, role: SpaceRole) => void;
  getCachedSpaceRoles: (spaceId: string) => SpaceRole[] | null;
  setCachedSpaceRoles: (spaceId: string, roles: SpaceRole[]) => void;
  // Room management
  getRoom: (roomId: string) => Room | undefined;
  setRoom: (room: Room) => void;
  // Invite management
  getInvite: (code: string) => InviteInfo | undefined;
  setInvite: (invite: InviteInfo) => void;
  deleteInvite: (code: string) => void;
  clearInvites: () => void;
  getInviteInfo: (code: string, fetchFn: () => Promise<InviteInfo>) => Promise<InviteInfo>;
};

const CacheContext = createContext<CacheContextType>();
const messageCache = new MessageCache();
const spaceCache = new SpaceCache();
const roomCache = new RoomCache();
const inviteCache = new InviteCache();

// Make caches globally accessible for WebSocketClient
declare global {
  interface Window {
    messageCache: MessageCache;
    spaceCache: SpaceCache;
    roomCache: RoomCache;
    inviteCache: InviteCache;
  }
}

// Expose caches globally
window.messageCache = messageCache;
window.spaceCache = spaceCache;
window.roomCache = roomCache;
window.inviteCache = inviteCache;

export const CacheProvider: ParentComponent = (props) => {
  const [users, setUsers] = createSignal<Record<string, User>>({});
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [rooms, setRooms] = createSignal<RoomWithRecipients[]>([]);
  const [relationships, setRelationships] = createSignal<string[]>([]);
  const [relationshipRequests, setRelationshipRequests] = createSignal<Relationship[]>([]);

  // Listen for user updates, message events, and space events
  createEffect(() => {
    const handleUserUpdate = (event: CustomEvent) => {
      const userData = event.detail;
      if (userData && userData.id) {
        setUser(userData);
      }
    };

    const handleMessageCreate = (event: CustomEvent) => {
      const { roomId, message } = event.detail;
      if (roomId && message) {
        console.log("[CacheProvider] Adding message to cache:", message);
        messageCache.addMessage(roomId, message);
      }
    };

    const handleMessageDelete = (event: CustomEvent) => {
      const { roomId, messageId } = event.detail;
      if (roomId && messageId) {
        console.log("[CacheProvider] Deleting message from cache:", { roomId, messageId });
        messageCache.deleteMessage(roomId, messageId);
      }
    };

    const handleSpaceCreate = (event: CustomEvent) => {
      const space = event.detail;
      if (space && space.id) {
        console.log("[CacheProvider] Adding space to cache:", space);
        spaceCache.setSpace(space);
        setSpaces(spaceCache.getAllSpaces());
      }
    };

    const handleRoomCreate = (event: CustomEvent) => {
      const room = event.detail;
      if (room && room.id) {
        console.log("[CacheProvider] Adding room to cache:", room);
        roomCache.setRoom(room);
        // Add to reactive rooms signal
        setRooms(prev => [...prev, room]);
      }
    };

    const handleRoomUpdate = (event: CustomEvent) => {
      const roomData = event.detail;
      if (roomData && roomData.room_id) {
        console.log("[CacheProvider] Updating room:", roomData);
        setRooms(prev => prev.map(room => {
          if (room.id === roomData.room_id) {
            return { ...room, ...roomData };
          }
          return room;
        }));
      }
    };
		const handleRoomVoiceUpdate = (event: CustomEvent) => {
			const data = event.detail as VoiceUpdateData;
			if (data && data.room_id) {
				const r = rooms().find(room => room.id === data.room_id);
				if (!r) return console.warn("[CacheProvider] Room to update voice state not found", data);
				
				const p = r.participants || [];
				const id = data.participant_id;
				if (data.event_type === "VOICE_PARTICIPANT_JOIN") {
					if (p.findIndex(e => e === id) !== -1) return;
					p.push(id);
				} else if (data.event_type === "VOICE_PARTICIPANT_LEAVE") {
					const idx = p.findIndex(e => e === id);
					if (idx === -1) return;
					p.splice(idx, 1);
				}

				console.log("[CacheProvider] Updating room:", data.room_id);
				setRooms(prev => prev.map(room => {
					if (room.id === data.room_id) {
						return { ...room, participants: p };
					}
					return room;
				}));
			}
		}

    const handleRelationshipUpdate = (event: CustomEvent) => {
      const { relationships: newRelationships, relationshipRequests: newRequests } = event.detail;
      if (newRelationships) {
        console.log("[CacheProvider] Updating relationships:", newRelationships);
        setRelationships(newRelationships);
      }
      if (newRequests) {
        console.log("[CacheProvider] Updating relationship requests:", newRequests);
        setRelationshipRequests(newRequests);
      }
    };

    const handleRoomsCache = (event: CustomEvent) => {
      const roomsData = event.detail;
      if (roomsData && Array.isArray(roomsData)) {
        console.log("[CacheProvider] Caching rooms:", roomsData);
        setRooms(roomsData);
        // Also cache in RoomCache
        roomsData.forEach(room => roomCache.setRoom(room));
      }
    };

    const handleSpaceUpdate = (event: CustomEvent) => {
      const space = event.detail;
      if (space && space.id) {
        console.log("[CacheProvider] Updating space in cache:", space);
        spaceCache.setSpace(space);
        setSpaces(spaceCache.getAllSpaces());
      }
    };

    const handleSpaceDelete = (event: CustomEvent) => {
      const { spaceId } = event.detail;
      if (spaceId) {
        console.log("[CacheProvider] Deleting space from cache:", spaceId);
        spaceCache.deleteSpace(spaceId);
        setSpaces(spaceCache.getAllSpaces());
      }
    };

    const handleSpaceMemberCreate = (event: CustomEvent) => {
      const spaceMember = event.detail;
      if (spaceMember && spaceMember.space_id && spaceMember.user_id) {
        console.log("[CacheProvider] Adding space member to cache:", spaceMember);
        spaceCache.setSpaceMember(spaceMember);
        setSpaces(spaceCache.getAllSpaces());
      }
    };

    const handleSpaceMembersCache = (event: CustomEvent) => {
      const { spaceId, members } = event.detail;
      if (spaceId && members && Array.isArray(members)) {
        console.log(`[CacheProvider] Caching ${members.length} members for space ${spaceId}`);
        spaceCache.setCachedSpaceMembers(spaceId, members);
      }
    };

    const handleSpaceRolesCache = (event: CustomEvent) => {
      const { spaceId, roles } = event.detail;
      if (spaceId && roles && Array.isArray(roles)) {
        console.log(`[CacheProvider] Caching ${roles.length} roles for space ${spaceId}`);
        spaceCache.setCachedSpaceRoles(spaceId, roles);
      }
    };

    const handleSpaceMemberRoleUpdate = (event: CustomEvent) => {
      console.log(`[CacheProvider] Received spaceMemberRoleUpdate event:`, event.detail);
      const { spaceId, member } = event.detail;
      if (spaceId && member) {
        console.log(`[CacheProvider] Member role updated for space ${spaceId}:`, member);
        spaceCache.updateCachedSpaceMember(spaceId, member);
        // Dispatch a general spaceMemberUpdate event to trigger UI reactivity
        console.log(`[CacheProvider] Dispatching spaceMemberUpdate event for space ${spaceId}`);
        window.dispatchEvent(new CustomEvent('spaceMemberUpdate', { 
          detail: { spaceId, member }
        }));
      } else {
        console.warn(`[CacheProvider] Invalid spaceMemberRoleUpdate event data:`, event.detail);
      }
    };

    const handleSpaceMemberRemove = (event: CustomEvent) => {
      console.log("[CacheProvider] Space member remove event:", event.detail);
      const { spaceId, userId } = event.detail;
      
      if (spaceId && userId) {
        // Remove member from space cache
        spaceCache.removeSpaceMember(spaceId, userId);
        
        // Update spaces state to trigger reactivity
        setSpaces(prev => [...prev]);
        
        // Dispatch spaceMemberUpdate event for UI reactivity
        window.dispatchEvent(new CustomEvent('spaceMemberUpdate', {
          detail: { spaceId, userId, action: 'remove' }
        }));
      }
    };

    const handleSpaceMemberAdd = (event: CustomEvent) => {
      console.log("[CacheProvider] Space member add event:", event.detail);
      const { spaceId, userId, roles } = event.detail;
      
      if (spaceId && userId) {
        // Add member to space cache
        spaceCache.addSpaceMember(spaceId, {
          user_id: userId,
          roles: roles || [],
          joined_at: new Date().toISOString(),
          deaf: false,
          mute: false,
          flags: 0,
          pending: false
        });
        
        // Update spaces state to trigger reactivity
        setSpaces(prev => [...prev]);
        
        // Dispatch spaceMemberUpdate event for UI reactivity
        window.dispatchEvent(new CustomEvent('spaceMemberUpdate', {
          detail: { spaceId, userId, action: 'add' }
        }));
      }
    };

    window.addEventListener("userUpdate", handleUserUpdate as EventListener);
    window.addEventListener("messageCreate", handleMessageCreate as EventListener);
    window.addEventListener("messageDelete", handleMessageDelete as EventListener);
    window.addEventListener("spaceCreate", handleSpaceCreate as EventListener);
    window.addEventListener("roomCreate", handleRoomCreate as EventListener);
		window.addEventListener("roomUpdate", handleRoomUpdate as EventListener);
		window.addEventListener("roomVoiceUpdate", handleRoomVoiceUpdate as EventListener);
    window.addEventListener("roomsCache", handleRoomsCache as EventListener);
    window.addEventListener("relationshipUpdate", handleRelationshipUpdate as EventListener);
    window.addEventListener("spaceUpdate", handleSpaceUpdate as EventListener);
    window.addEventListener("spaceDelete", handleSpaceDelete as EventListener);
    window.addEventListener("spaceMemberCreate", handleSpaceMemberCreate as EventListener);
    window.addEventListener("spaceMembersCache", handleSpaceMembersCache as EventListener);
    window.addEventListener("spaceRolesCache", handleSpaceRolesCache as EventListener);
    window.addEventListener("spaceMemberRoleUpdate", handleSpaceMemberRoleUpdate as EventListener);
    window.addEventListener("spaceMemberRemove", handleSpaceMemberRemove as EventListener);
    window.addEventListener("spaceMemberAdd", handleSpaceMemberAdd as EventListener);

    return () => {
      window.removeEventListener("userUpdate", handleUserUpdate as EventListener);
      window.removeEventListener("messageCreate", handleMessageCreate as EventListener);
      window.removeEventListener("messageDelete", handleMessageDelete as EventListener);
      window.removeEventListener("spaceCreate", handleSpaceCreate as EventListener);
      window.removeEventListener("roomCreate", handleRoomCreate as EventListener);
      window.removeEventListener("roomUpdate", handleRoomUpdate as EventListener);
      window.removeEventListener("roomsCache", handleRoomsCache as EventListener);
      window.removeEventListener("relationshipUpdate", handleRelationshipUpdate as EventListener);
      window.removeEventListener("spaceUpdate", handleSpaceUpdate as EventListener);
      window.removeEventListener("spaceDelete", handleSpaceDelete as EventListener);
      window.removeEventListener("spaceMemberCreate", handleSpaceMemberCreate as EventListener);
      window.removeEventListener("spaceMembersCache", handleSpaceMembersCache as EventListener);
      window.removeEventListener("spaceRolesCache", handleSpaceRolesCache as EventListener);
      window.removeEventListener("spaceMemberRoleUpdate", handleSpaceMemberRoleUpdate as EventListener);
      window.removeEventListener("spaceMemberRemove", handleSpaceMemberRemove as EventListener);
      window.removeEventListener("spaceMemberAdd", handleSpaceMemberAdd as EventListener);
    };
  });

  const setUser = (userData: Partial<User> & { id: string }) => {
    if (!userData || !userData.id) {
      console.warn("[CacheProvider] Invalid user data:", userData);
      return;
    }

    console.log("[CacheProvider] Setting user with data:", userData);

    setUsers((prev) => {
      const existingUser = prev[userData.id];
      return {
        ...prev,
        [userData.id]: {
          ...existingUser,
          ...userData,
          // Ensure presence is properly updated and merged
          presence: userData.presence || existingUser?.presence,
        },
      };
    });
  };

  const setUsersData = (usersData: Record<string, any>) => {
    console.log("[CacheProvider] setUsers called with:", usersData);
    setUsers((prev) => {
      const newUsers = { ...prev };
      Object.entries(usersData).forEach(([userId, userData]) => {
        console.log("[CacheProvider] Processing user:", { userId, userData });
        if (userData) {
          console.log("[CacheProvider] Valid user data:", userData);
          newUsers[userId] = {
            id: userData.ID,
            username: userData.Username,
            discriminator: userData.Discriminator,
            display_name: userData.DisplayName || userData.Username,
            about_me: userData.AboutMe,
            bio: userData.Bio,
            avatar: userData.Avatar,
            banner: userData.Banner,
            badges: userData.Badges,
            created_at: userData.created_at || userData.CreatedAt,
            updated_at: userData.updated_at || userData.UpdatedAt,
            flags: userData.flags || userData.Flags,
            bot: userData.bot || userData.Bot,
            system: userData.system || userData.System,
            presence: userData.Presence ? {
              status: userData.Presence.Status,
              custom_status: userData.Presence.CustomStatus,
            } : undefined,
          };
        } else {
          console.warn("[CacheProvider] Skipping invalid user data:", userData);
        }
      });
      return newUsers;
    });
  };

  const getUser = (userId: string): User | undefined => {
    return users()[userId];
  };

  const value = {
    users,
    getUser,
    setUser,
    setUsers: setUsersData,
    // Room management
    rooms,
    setRooms,
    // Relationship management
    relationships,
    setRelationships,
    relationshipRequests,
    setRelationshipRequests,
    getMessages: (roomId: string) => messageCache.getMessages(roomId),
    getMessage: (roomId: string, messageId: string) => messageCache.getMessages(roomId).find(m => m.id === messageId || m.nonce === messageId),
    getMessageCount: (roomId: string) => messageCache.getMessageCount(roomId),
    setMessages: (roomId: string, messages: CachedMessage[], position?: 'newer' | 'older' | 'replace') => messageCache.setMessages(roomId, messages, position),
    addMessage: (roomId: string, message: CachedMessage) => messageCache.addMessage(roomId, message),
    updateMessage: (roomId: string, messageId: string, updates: Partial<CachedMessage>) => messageCache.updateMessage(roomId, messageId, updates),
    updateMessageByNonce: (roomId: string, nonce: string, updates: Partial<CachedMessage>) => messageCache.updateMessageByNonce(roomId, nonce, updates),
    deleteMessage: (roomId: string, messageId: string) => messageCache.deleteMessage(roomId, messageId),
    hasMessages: (roomId: string) => messageCache.hasMessages(roomId),
    getOldestMessageId: (roomId: string) => messageCache.getOldestMessageId(roomId),
    getNewestMessageId: (roomId: string) => messageCache.getNewestMessageId(roomId),
    hasReachedBeginning: (roomId: string) => messageCache.hasReachedBeginning(roomId),
    hasReachedEnd: (roomId: string) => messageCache.hasReachedEnd(roomId),
    setHasReachedBeginning: (roomId: string, reached: boolean) => messageCache.setHasReachedBeginning(roomId, reached),
    setHasReachedEnd: (roomId: string, reached: boolean) => messageCache.setHasReachedEnd(roomId, reached),
    resetReachedFlags: (roomId: string) => messageCache.resetReachedFlags(roomId),
    getLastFetchTime: (roomId: string) => messageCache.getLastFetchTime(roomId),
    // Space management
    spaces,
    getSpace: (spaceId: string) => spaceCache.getSpace(spaceId),
    setSpace: (space: Space) => {
      spaceCache.setSpace(space);
      setSpaces(spaceCache.getAllSpaces());
    },
    getUserSpaces: (userId: string) => spaceCache.getUserSpaces(userId),
    getSpaceMembers: (spaceId: string) => spaceCache.getSpaceMembers(spaceId),
    getSpaceMember: (spaceId: string, userId: string) => spaceCache.getSpaceMember(spaceId, userId),
    setSpaceMember: (spaceMember: SpaceMember) => {
      spaceCache.setSpaceMember(spaceMember);
      setSpaces(spaceCache.getAllSpaces());
    },
    addSpaceMember: (spaceId: string, memberData: Partial<SpaceMember> & { user_id: string }) => {
      spaceCache.addSpaceMember(spaceId, memberData);
      setSpaces(spaceCache.getAllSpaces());
    },
    removeSpaceMember: (spaceId: string, userId: string) => {
      spaceCache.removeSpaceMember(spaceId, userId);
      setSpaces(spaceCache.getAllSpaces());
    },
    deleteSpace: (spaceId: string) => {
      spaceCache.deleteSpace(spaceId);
      setSpaces(spaceCache.getAllSpaces());
    },
    // Space members cache
    getCachedSpaceMembers: (spaceId: string) => spaceCache.getCachedSpaceMembers(spaceId),
    setCachedSpaceMembers: (spaceId: string, members: SpaceMember[]) => spaceCache.setCachedSpaceMembers(spaceId, members),
    updateCachedSpaceMember: (spaceId: string, member: SpaceMember) => spaceCache.updateCachedSpaceMember(spaceId, member),
    // Space roles
    getSpaceRoles: (spaceId: string) => spaceCache.getSpaceRoles(spaceId),
    getSpaceRole: (spaceId: string, roleId: string) => spaceCache.getSpaceRole(spaceId, roleId),
    setSpaceRole: (spaceId: string, role: SpaceRole) => spaceCache.setSpaceRole(spaceId, role),
    getCachedSpaceRoles: (spaceId: string) => spaceCache.getCachedSpaceRoles(spaceId),
    setCachedSpaceRoles: (spaceId: string, roles: SpaceRole[]) => spaceCache.setCachedSpaceRoles(spaceId, roles),
    // Room management
    getRoom: (roomId: string) => roomCache.getRoom(roomId),
    setRoom: (room: Room) => roomCache.setRoom(room),
    // Invite management
    getInvite: (code: string) => inviteCache.getInvite(code),
    setInvite: (invite: InviteInfo) => inviteCache.setInvite(invite),
    deleteInvite: (code: string) => inviteCache.deleteInvite(code),
    clearInvites: () => inviteCache.clearInvites(),
    getInviteInfo: (code: string, fetchFn: () => Promise<InviteInfo>) => inviteCache.getInviteInfo(code, fetchFn),
  };

  return (
    <CacheContext.Provider value={value}>
      {props.children}
    </CacheContext.Provider>
  );
};

export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCache must be used within a CacheProvider");
  }
  return context;
};

export type { Space };

