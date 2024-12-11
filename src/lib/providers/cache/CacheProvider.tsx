import {
  ParentComponent,
  createContext,
  useContext,
  createSignal,
} from "solid-js";

export type Presence = {
  status: string;
  online: boolean;
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
  bots?: string[];
  system?: boolean;
  bio?: string;
  flags?: number;
  about_me?: string;
  accent_color?: string;
  locale?: string;
  presence?: Presence;
  created_at?: string;
  updated_at?: string;
};

type CacheContextType = {
  users: () => Record<string, User>;
  getUser: (id: string) => User | undefined;
  setUser: (user: Partial<User> & { id: string }) => void;
  setUsers: (usersData: Record<string, any>) => void;
};

const CacheContext = createContext<CacheContextType>();

export const CacheProvider: ParentComponent = (props) => {
  const [users, setUsers] = createSignal<Record<string, User>>({});

  const setUser = (userData: Partial<User> & { id: string }) => {
    if (!userData || !userData.id) {
      console.warn("[CacheProvider] Invalid user data:", userData);
      return;
    }

    setUsers((prev) => ({
      ...prev,
      [userData.id]: {
        ...prev[userData.id],
        ...userData,
      },
    }));
  };

  const setUsersData = (usersData: Record<string, any>) => {
    console.log("[CacheProvider] setUsers called with:", usersData);
    setUsers((prev) => {
      const newUsers = { ...prev };
      Object.entries(usersData).forEach(([userId, userData]) => {
        console.log("[CacheProvider] Processing user:", { userId, userData });
        if (userData) {
          newUsers[userId] = {
            id: userData.ID,
            username: userData.Username,
            discriminator: userData.Discriminator,
            display_name: userData.DisplayName || userData.Username,
            avatar: userData.Avatar,
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
