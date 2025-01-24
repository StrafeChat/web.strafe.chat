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
};

type AuthContextType = {
  user: () => Clientuser | null;
  setUser: (user: Clientuser | null) => void;
  relationships: () => string[];
  setRelationships: (relationships: string[]) => void;
  relationshipRequests: () => Relationship[];
  setRelationshipRequests: (requests: Relationship[]) => void;
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: () => boolean;
  loading: () => boolean;
  isMobile: () => boolean;
  wsClient: () => WebSocketClient | null;
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
  const [relationshipRequests, setRelationshipRequests] = createSignal<Relationship[]>([]);
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

  const initializeWebSocket = () => {
    const ws = new WebSocket(WS_URL);
    const client = new WebSocketClient(ws);
    setWsClient(client);

    client.onConnectionStateChange((connected) => {
      console.log("[AuthProvider] WebSocket connection state:", connected);
      if (!connected) {
        setLoading(true); // Show loading when connection is lost
      }
    });

    const token = localStorage.getItem("sc_token");
    if (token) {
      client.connect(token).catch((error) => {
        console.error("[WebSocket] Failed to connect:", error);
      });
    }

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
          date_of_birth: data.client_user.DateOfBirth,
          friends: data.client_user.Friends || [],
        };
        console.log("[AuthProvider:READY] Setting user data:", userData);
        setUser(userData);
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

      // Only set loading to false after all data is processed
      console.log(
        "[AuthProvider:READY] All data processed, setting loading to false"
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

    return client.isConnected();
  };

  const fetchUserData = async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      await debugLog("[AuthProvider] Starting fetchUserData", {
        hasToken: !!token,
        isMobile: isMobile(),
      });

      const res = await fetch(API_ENDPOINTS.USER_ME, {
        headers: {
          ...API_HEADERS.JSON,
          "X-Session-Token": token,
        },
      });

      await debugLog("[AuthProvider] User data response received", {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || "Failed to fetch user data";
        } catch {
          errorMessage = errorText || `HTTP Error: ${res.status}`;
        }
        
        await debugLog("[AuthProvider] fetchUserData failed", {
          status: res.status,
          error: errorMessage,
        });
        setIsAuthenticated(false);
        setLoading(false);
        return { success: false, error: errorMessage };
      }

      const data = await res.json();
      await debugLog("[AuthProvider] User data parsed", {
        hasClientUser: !!data.client_user,
        clientUser: data.client_user,
      });

      const clientUser = data.client_user;
      if (
        !clientUser ||
        !clientUser.id ||
        !clientUser.username ||
        !clientUser.discriminator ||
        !clientUser.email
      ) {
        await debugLog("[AuthProvider] Invalid client user data", {
          clientUser,
          hasId: !!clientUser?.id,
          hasUsername: !!clientUser?.username,
          hasDiscriminator: !!clientUser?.discriminator,
          hasEmail: !!clientUser?.email,
        });
        setIsAuthenticated(false);
        setLoading(false);
        return { success: false, error: "Invalid client user data" };
      }

      const normalizedUser = {
        id: clientUser.id,
        username: clientUser.username,
        discriminator: clientUser.discriminator,
        display_name: clientUser.display_name,
        avatar: clientUser.avatar,
        email: clientUser.email,
      };

      await debugLog("[AuthProvider] Setting up user state", {
        normalizedUser,
      });

      cache.setUser(normalizedUser);
      setUser(normalizedUser);
      setIsAuthenticated(true);

      if (Array.isArray(data.relationships)) {
        await debugLog("[AuthProvider] Processing relationships", {
          relationshipCount: data.relationships.length,
        });
        const friendIds = data.relationships
          .filter((rel: Relationship) => rel.type === "accepted")
          .map((rel: Relationship) => {
            return rel.sender_id === data.client_user.ID
              ? rel.recipient_id
              : rel.sender_id;
          });
        setRelationships(friendIds);

        const requests = data.relationships.filter(
          (rel: Relationship) =>
            rel.recipient_id === data.client_user.ID && !rel.type
        );
        setRelationshipRequests(requests);
      }

      const wsConnected = initializeWebSocket();
      await debugLog("[AuthProvider] WebSocket initialization", {
        connected: wsConnected,
      });

      setLoading(false);
      return { success: true };
    } catch (error) {
      await debugLog("[AuthProvider] fetchUserData error", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      setIsAuthenticated(false);
      setLoading(false);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  const debugLog = async (message: string, data: any) => {
    try {
      await fetch(`${BASE_URL}/debug/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          data,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        /* ignore errors */
      });
    } catch {
      /* ignore errors */
    }
  };

  const login = async (credentials: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      await debugLog("[AuthProvider] Starting login attempt", {
        email: credentials.email,
        isMobile: isMobile(),
        userAgent: navigator.userAgent,
      });

      const res = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: API_HEADERS.JSON,
        body: JSON.stringify(credentials),
      });

      await debugLog("[AuthProvider] Login response received", {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || "Unknown error";
        } catch {
          errorMessage = errorText || `HTTP Error: ${res.status}`;
        }
        
        await debugLog("[AuthProvider] Login failed", {
          status: res.status,
          error: errorMessage,
        });
        setIsAuthenticated(false);
        setLoading(false);
        return { success: false, error: errorMessage };
      }

      let data;
      try {
        data = await res.json();
        await debugLog("[AuthProvider] Login response parsed", {
          hasToken: !!data.token,
        });
      } catch (e) {
        const error = "Failed to parse login response";
        await debugLog("[AuthProvider] Failed to parse login response", {
          error: e,
          responseText: await res.text(),
        });
        console.error("[AuthProvider] Failed to parse login response:", e);
        setIsAuthenticated(false);
        setLoading(false);
        return { success: false, error };
      }

      if (!data.token) {
        const error = "No token received from server";
        await debugLog("[AuthProvider] No token in response", { data });
        setIsAuthenticated(false);
        setLoading(false);
        return { success: false, error };
      }

      localStorage.setItem("sc_token", data.token);
      const userDataResult = await fetchUserData(data.token);
      
      if (!userDataResult.success) {
        return { success: false, error: userDataResult.error || "Failed to fetch user data" };
      }

      await debugLog("[AuthProvider] Login flow completed", {
        success: true,
        authenticated: isAuthenticated(),
        hasUser: !!user(),
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      await debugLog("[AuthProvider] Login error", {
        error,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error("[AuthProvider] Login error:", error);
      setIsAuthenticated(false);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
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
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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
