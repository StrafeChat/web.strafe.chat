import {
  ParentComponent,
  createContext,
  useContext,
  createSignal,
  createEffect,
} from "solid-js";
import { MessageCache, CachedMessage } from "../../cache/MessageCache";
import { SpaceCache, Space, SpaceMember, SpaceRole } from "../../cache/SpaceCache";
import { InviteCache } from "./InviteCache";
import { InviteInfo } from "../../../types/api";

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
  users: () => Record<string, User>;
  getUser: (id: string) => User | undefined;
  setUser: (user: Partial<User> & { id: string }) => void;
  setUsers: (usersData: Record<string, any>) => void;
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
const inviteCache = new InviteCache();

// Make caches globally accessible for WebSocketClient
declare global {
  interface Window {
    messageCache: MessageCache;
    spaceCache: SpaceCache;
    inviteCache: InviteCache;
  }
}

// Expose caches globally
window.messageCache = messageCache;
window.spaceCache = spaceCache;
window.inviteCache = inviteCache;

export const CacheProvider: ParentComponent = (props) => {
  const [users, setUsers] = createSignal<Record<string, User>>({});
  const [spaces, setSpaces] = createSignal<Space[]>([]);

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

    window.addEventListener("userUpdate", handleUserUpdate as EventListener);
    window.addEventListener("messageCreate", handleMessageCreate as EventListener);
    window.addEventListener("messageDelete", handleMessageDelete as EventListener);
    window.addEventListener("spaceCreate", handleSpaceCreate as EventListener);
    window.addEventListener("spaceUpdate", handleSpaceUpdate as EventListener);
    window.addEventListener("spaceDelete", handleSpaceDelete as EventListener);
    window.addEventListener("spaceMemberCreate", handleSpaceMemberCreate as EventListener);
    window.addEventListener("spaceMembersCache", handleSpaceMembersCache as EventListener);
    window.addEventListener("spaceRolesCache", handleSpaceRolesCache as EventListener);
    window.addEventListener("spaceMemberRoleUpdate", handleSpaceMemberRoleUpdate as EventListener);

    return () => {
      window.removeEventListener("userUpdate", handleUserUpdate as EventListener);
      window.removeEventListener("messageCreate", handleMessageCreate as EventListener);
      window.removeEventListener("messageDelete", handleMessageDelete as EventListener);
      window.removeEventListener("spaceCreate", handleSpaceCreate as EventListener);
      window.removeEventListener("spaceUpdate", handleSpaceUpdate as EventListener);
      window.removeEventListener("spaceDelete", handleSpaceDelete as EventListener);
      window.removeEventListener("spaceMemberCreate", handleSpaceMemberCreate as EventListener);
      window.removeEventListener("spaceMembersCache", handleSpaceMembersCache as EventListener);
      window.removeEventListener("spaceRolesCache", handleSpaceRolesCache as EventListener);
      window.removeEventListener("spaceMemberRoleUpdate", handleSpaceMemberRoleUpdate as EventListener);
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

