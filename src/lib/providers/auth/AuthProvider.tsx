import {
  createContext,
  createSignal,
  useContext,
  createEffect,
  ParentComponent,
  createMemo,
  onCleanup,
} from "solid-js";
import { WebSocketClient } from "../../ws/WebSocketClient";
import { useCache } from "../cache/CacheProvider";
import { handleWebSocketMessage } from "../../events";
import { BASE_URL, WS_URL } from "../../../constants";

export const API_ENDPOINTS = {
  REGISTER: `${BASE_URL}/auth/register`,
  LOGIN: `${BASE_URL}/auth/login`,
  USER_ME: `${BASE_URL}/users/@me`,
  RELATIONSHIPS: `${BASE_URL}/users/@me/relationships`,
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

type Clientuser = {
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
  login: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  register: (
    data: RegisterData
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: () => boolean;
  loading: () => boolean;
  isMobile: () => boolean;
  wsClient: () => WebSocketClient | null;
  updateStatus: (status?: string, customStatus?: string) => Promise<boolean>;
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

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const cache = useCache();
  const [user, setUser] = createSignal<Clientuser | null>(null);
  const [relationships, setRelationships] = createSignal<string[]>([]);
  const [relationshipRequests, setRelationshipRequests] = createSignal<
    Relationship[]
  >([]);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [isMobile, setIsMobile] = createSignal(window.innerWidth <= 768);
  const [wsClient, setWsClient] = createSignal<WebSocketClient | null>(null);

  const mobileCheck = createMemo(() => isMobile());

  createEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  createEffect(() => {
    console.log(
      "[AuthProvider:effect] Current relationships value:",
      relationships()
    );
  });

  const logError = (context: string, error: unknown) => {
    console.error(`[AuthProvider:${context}]`, error);
  };

  const initializeWebSocket = (
    token: string = localStorage.getItem("sc_token") || ""
  ) => {
    if (!token) return false;

    const ws = new WebSocket(WS_URL);
    const client = new WebSocketClient(ws);
    setWsClient(client);

    client.onConnectionStateChange((connected) => {
      console.log("[AuthProvider] WebSocket connection state:", connected);
      if (!connected) {
        setLoading(true); // Show loading when connection is lost
      }
    });

    client.connect(token).catch((error) => {
      console.error("[WebSocket] Failed to connect:", error);
    });

    client.onMessage("READY", (data) => {
      console.log(
        "[AuthProvider:READY] Full data payload:",
        JSON.stringify(data, null, 2)
      );

      // Process all data before setting loading to false
      if (data.client_user) {
        const userData = {
          id: data.client_user.ID,
          username: data.client_user.Username,
          discriminator: data.client_user.Discriminator,
          display_name:
            data.client_user.DisplayName || data.client_user.Username,
          email: data.client_user.Email,
          avatar: data.client_user.Avatar,
          banner: data.client_user.Banner,
          date_of_birth: data.client_user.DateOfBirth,
          friends: data.client_user.Friends || [],
          presence: {
            status: data.client_user.Presence.Status,
            custom_status: data.client_user.Presence.CustomStatus,
          },
        };
        console.log("[AuthProvider:READY] Setting user data:", userData);
        setUser(userData);
        setIsAuthenticated(true);
      }

      if (data.users) {
        console.log("[AuthProvider:READY] Setting users in cache:", data.users);
        cache.setUsers(data.users);
      }

      if (data.relationships) {
        console.log(
          "[AuthProvider:READY] Setting relationships:",
          data.relationships
        );
        setRelationships(data.relationships);
      }

      if (data.relationship_requests) {
        console.log(
          "[AuthProvider:READY] Setting relationship requests:",
          data.relationship_requests
        );
        const requests = data.relationship_requests.map((request: any) => ({
          id: request.ID,
          sender_id: request.SenderID,
          recipient_id: request.RecipientID,
          created_at: request.CreatedAt || new Date().toISOString(),
        }));
        console.log(
          "[AuthProvider:READY] Mapped relationship requests:",
          requests
        );
        setRelationshipRequests(requests);
      }

      // Verify all required data is present before removing loading screen
      if (!data.client_user || !data.users) {
        console.error("[AuthProvider:READY] Missing required data");
        return;
      }

      // Only set loading to false after all data is processed and verified
      console.log(
        "[AuthProvider:READY] All data processed and verified, setting loading to false"
      );
      setLoading(false);
    });

    client.onMessage("relationshipCreate", (data) => {
      handleWebSocketMessage(
        { type: "relationshipCreate", ...data },
        cache,
        setRelationshipRequests,
        setRelationships,
        user()?.id || ""
      );
    });

    client.onMessage("relationshipAccept", (data) => {
      handleWebSocketMessage(
        { type: "relationshipAccept", ...data },
        cache,
        setRelationshipRequests,
        setRelationships,
        user()?.id || ""
      );

      const currentUser = user();
      if (currentUser) {
        const otherUserId =
          currentUser.id === data.sender_id
            ? data.recipient_id
            : data.sender_id;
        setUser({
          ...currentUser,
          friends: [...(currentUser.friends || []), otherUserId],
        });
      }
    });

    client.onMessage("relationshipDelete", (data) => {
      handleWebSocketMessage(
        { type: "relationshipDelete", ...data },
        cache,
        setRelationshipRequests,
        setRelationships,
        user()?.id || ""
      );
    });

    return true;
  };

  const fetchUserData = async (
    token: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Don't set loading to false here, let the WebSocket READY event handle it
      const res = await fetch(API_ENDPOINTS.USER_ME, {
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });

      if (!res.ok) {
        setLoading(false); // Only set loading false on error
        return { success: false, error: "Failed to fetch user data" };
      }

      const data = await res.json();

      if (!data || !data.client_user) {
        setLoading(false); // Only set loading false on error
        return { success: false, error: "Invalid response format" };
      }

      // Process user data
      const userData = {
        id: data.client_user.ID,
        username: data.client_user.Username,
        discriminator: data.client_user.Discriminator,
        display_name: data.client_user.DisplayName || data.client_user.Username,
        email: data.client_user.Email,
        avatar: data.client_user.Avatar,
        date_of_birth: data.client_user.DateOfBirth,
        friends: data.client_user.Friends || [],
      };

      setUser(userData);

      // Process relationships if available
      if (data.relationships) {
        setRelationships(data.relationships);
      }

      // Initialize WebSocket connection
      initializeWebSocket(token);
      setIsAuthenticated(true);

      return { success: true };
    } catch (error) {
      setLoading(false); // Only set loading false on error
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const login = async (credentials: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      const res = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: API_HEADERS.JSON,
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        return { success: false, error: "Invalid credentials" };
      }

      try {
        const data = await res.json();

        if (!data || !data.token) {
          return { success: false, error: "No token in response" };
        }

        localStorage.setItem("sc_token", data.token);
        const result = await fetchUserData(data.token);
        setIsAuthenticated(result.success);
        return result;
      } catch (parseError) {
        return { success: false, error: "Failed to parse response" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    data: RegisterData
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: API_HEADERS.JSON,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        logError("register", `Registration failed: ${res.status}`);
        setIsAuthenticated(false);
        setLoading(false);
        return { success: false, error: `Registration failed: ${res.status}` };
      }

      const { token } = await res.json();
      localStorage.setItem("sc_token", token);

      return await fetchUserData(token);
    } catch (error) {
      logError("register", error);
      setIsAuthenticated(false);
      setLoading(false);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
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

    // Only update fields that are present in userUpdate
    const updatedUser = {
      ...currentUser,
      ...Object.fromEntries(
        Object.entries(userUpdate).filter(([_, value]) => value !== undefined)
      ),
    };

    setUser(updatedUser);
  };

  const updateStatus = async (status?: string, customStatus?: string) => {
    try {
      const res = await fetch(`${BASE_URL}/users/@me/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": localStorage.getItem("sc_token") || "",
        },
        body: JSON.stringify({
          status,
          custom_status: customStatus,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      const updatedUser = await res.json();
      setUser(updatedUser);
      return true;
    } catch (error) {
      console.error("Error updating status:", error);
      return false;
    }
  };

  onCleanup(() => {
    const client = wsClient();
    if (client) {
      client.disconnect();
      setWsClient(null);
    }
  });

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
        login,
        register,
        logout,
        isAuthenticated: () => isAuthenticated(),
        loading: () => loading(),
        isMobile: mobileCheck,
        wsClient: () => wsClient(),
        updateStatus,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
