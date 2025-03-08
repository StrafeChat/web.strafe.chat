import {
  ParentComponent,
  createContext,
  useContext,
  createSignal,
  createEffect,
} from "solid-js";
import { MessageCache, CachedMessage } from "../../cache/MessageCache";

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
  setMessages: (roomId: string, messages: CachedMessage[]) => void;
  addMessage: (roomId: string, message: CachedMessage) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<CachedMessage>) => void;
  deleteMessage: (roomId: string, messageId: string) => void;
};

const CacheContext = createContext<CacheContextType>();
const messageCache = new MessageCache();

export const CacheProvider: ParentComponent = (props) => {
  const [users, setUsers] = createSignal<Record<string, User>>({});

  // Listen for user updates and message events
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

    window.addEventListener("userUpdate", handleUserUpdate as EventListener);
    window.addEventListener("messageCreate", handleMessageCreate as EventListener);

    return () => {
      window.removeEventListener("userUpdate", handleUserUpdate as EventListener);
      window.removeEventListener("messageCreate", handleMessageCreate as EventListener);
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
            avatar: userData.Avatar,
            presence: {
              status: userData.Presence.Status,
              custom_status: userData.Presence.CustomStatus,
            },
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
    setMessages: (roomId: string, messages: CachedMessage[]) => messageCache.setMessages(roomId, messages),
    addMessage: (roomId: string, message: CachedMessage) => messageCache.addMessage(roomId, message),
    updateMessage: (roomId: string, messageId: string, updates: Partial<CachedMessage>) => messageCache.updateMessage(roomId, messageId, updates),
    deleteMessage: (roomId: string, messageId: string) => messageCache.deleteMessage(roomId, messageId)
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
