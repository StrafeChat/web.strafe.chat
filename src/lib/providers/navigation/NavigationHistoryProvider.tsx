import { createContext, useContext, ParentProps, createSignal } from "solid-js";

interface NavigationHistory {
  lastHomeRoute: string;
  lastSpaceRoutes: Record<string, string>; // spaceId -> last route in that space
}

interface NavigationHistoryContextType {
  getLastHomeRoute: () => string;
  getLastSpaceRoute: (spaceId: string) => string;
  updateHistory: (route: string) => void;
}

const NAVIGATION_HISTORY_KEY = "sc_navigation_history";

const defaultHistory: NavigationHistory = {
  lastHomeRoute: "/",
  lastSpaceRoutes: {}
};

const NavigationHistoryContext = createContext<NavigationHistoryContextType>();

const getStoredHistory = (): NavigationHistory => {
  try {
    const stored = localStorage.getItem(NAVIGATION_HISTORY_KEY);
    return stored ? { ...defaultHistory, ...JSON.parse(stored) } : defaultHistory;
  } catch {
    return defaultHistory;
  }
};

const saveHistory = (history: NavigationHistory) => {
  try {
    localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save navigation history:", e);
  }
};

export const NavigationHistoryProvider = (props: ParentProps) => {
  const [history, setHistory] = createSignal<NavigationHistory>(getStoredHistory());

  const updateHistory = (route: string) => {
    setHistory(prev => {
      const newHistory = { ...prev };
      
      // Check if it's a space route
      const spaceMatch = route.match(/^\/spaces\/(\d+)(.*)$/);
      if (spaceMatch) {
        const spaceId = spaceMatch[1];
        newHistory.lastSpaceRoutes[spaceId] = route;
      } else if (route === "/" || route === "/home" || route === "/friends" || route === "/notes" || route.startsWith("/rooms")) {
        // Update last home route for home section routes
        newHistory.lastHomeRoute = route;
      }
      
      // Save to localStorage
      saveHistory(newHistory);
      return newHistory;
    });
  };

  const getLastHomeRoute = () => {
    return history().lastHomeRoute;
  };

  const getLastSpaceRoute = (spaceId: string) => {
    return history().lastSpaceRoutes[spaceId] || `/spaces/${spaceId}`;
  };

  const contextValue: NavigationHistoryContextType = {
    getLastHomeRoute,
    getLastSpaceRoute,
    updateHistory
  };

  return (
    <NavigationHistoryContext.Provider value={contextValue}>
      {props.children}
    </NavigationHistoryContext.Provider>
  );
};

export const useNavigationHistory = () => {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error("useNavigationHistory must be used within a NavigationHistoryProvider");
  }
  return context;
};