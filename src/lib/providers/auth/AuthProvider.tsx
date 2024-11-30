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

// API Configuration
const BASE_URL = "http://127.0.0.1:443";
const WS_URL = "ws://127.0.0.1:8080/events";
const API_ENDPOINTS = {
  REGISTER: `${BASE_URL}/auth/register`,
  LOGIN: `${BASE_URL}/auth/login`,
  USER_ME: `${BASE_URL}/users/@me`,
};

const API_HEADERS = {
  JSON: { "Content-Type": "application/json" },
};

type User = {
  id: string;
  username: string;
  discriminator: string;
  display_name?: string;
  email: string;
  date_of_birth?: string;
  avatar?: string;
  global_name?: string;
};

type AuthContextType = {
  user: () => User | null;
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
  isAuthenticated: () => boolean;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  loading: () => boolean;
  isMobile: () => boolean;
  wsClient: () => WebSocketClient | null;
};

interface RegisterData {
  username: string;
  discriminator: string;
  display_name?: string;
  email: string;
  password: string;
  date_of_birth: string;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [isMobile, setIsMobile] = createSignal(window.innerWidth <= 768);
  const [wsClient, setWsClient] = createSignal<WebSocketClient | null>(null);

  // Memoized mobile check for better performance
  const mobileCheck = createMemo(() => isMobile());

  createEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  const logError = (context: string, error: unknown) => {
    console.error(`[AuthProvider] Error in ${context}:`, error);
  };

  const initializeWebSocket = async (token: string) => {
    try {
      const client = new WebSocketClient(WS_URL);

      // Add connection state handler
      client.onConnectionStateChange((connected) => {
        console.log("[AuthProvider] WebSocket connection state:", connected);
        setLoading(!connected);
      });

      const connected = await client.connect(token);

      if (connected) {
        setWsClient(client);
        // Remove heartbeat response - the worker will handle heartbeats
        return true;
      }
      return false;
    } catch (error) {
      logError("initializeWebSocket", error);
      return false;
    }
  };

  const fetchUserData = async (token: string): Promise<boolean> => {
    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.USER_ME, {
        method: "GET",
        headers: {
          "X-Session-Token": token,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        logError("fetchUserData", `HTTP Error: ${res.status}`);
        setIsAuthenticated(false);
        setLoading(false);
        return false;
      }

      const data = await res.json();

      const userData: User = {
        id: data.client_user?.id || data.id || "",
        username: data.client_user?.username || data.username || "",
        discriminator:
          data.client_user?.discriminator || data.discriminator || "",
        display_name:
          data.client_user?.display_name ||
          data.client_user?.global_name ||
          data.display_name ||
          data.global_name ||
          data.username,
        email: data.client_user?.email || data.email || "",
        date_of_birth:
          data.client_user?.date_of_birth || data.date_of_birth || "",
        avatar: data.client_user?.avatar || data.avatar || "",
        global_name: data.client_user?.global_name || data.global_name,
      };

      // Set user data first
      setUser(userData);
      setIsAuthenticated(true);

      // Then establish WebSocket connection
      const wsConnected = await initializeWebSocket(token);
      if (!wsConnected) {
        logError("fetchUserData", "Failed to establish WebSocket connection");
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return false;
      }

      // Only remove loading state after both user verification and WebSocket connection
      setLoading(false);
      return true;
    } catch (error) {
      logError("fetchUserData", error);
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }
  };

  // Optimize initial token check
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

  // Call initialization on provider mount
  initializeAuth();

  const login = async (credentials: {
    email: string;
    password: string;
  }): Promise<boolean> => {
    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: API_HEADERS.JSON,
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        logError("login", `Login failed: ${res.status}`);
        setIsAuthenticated(false);
        setLoading(false);
        return false;
      }

      const { token } = await res.json();
      localStorage.setItem("sc_token", token);

      return await fetchUserData(token);
    } catch (error) {
      logError("login", error);
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      setLoading(true);
      const apiData = {
        ...data,
        discriminator: parseInt(data.discriminator),
        display_name: data.display_name || undefined,
      };

      const res = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: API_HEADERS.JSON,
        body: JSON.stringify(apiData),
      });

      if (!res.ok) {
        logError("register", `Registration failed: ${res.status}`);
        setIsAuthenticated(false);
        setLoading(false);
        return false;
      }

      const { token } = await res.json();
      localStorage.setItem("sc_token", token);

      return await fetchUserData(token);
    } catch (error) {
      logError("register", error);
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    wsClient()?.disconnect();
    setWsClient(null);
    localStorage.removeItem("sc_token");
    setUser(null);
    setIsAuthenticated(false);
    setLoading(false);
    window.location.href = "/login";
  };

  onCleanup(() => {
    wsClient()?.disconnect();
  });

  const value = {
    user,
    login,
    register,
    logout,
    isAuthenticated: () => isAuthenticated(),
    loading: () => loading(),
    isMobile: mobileCheck,
    wsClient: () => wsClient(),
  };

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
