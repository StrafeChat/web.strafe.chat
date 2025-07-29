import {
  createContext,
  createSignal,
  useContext,
  createEffect,
  type ParentComponent,
} from "solid-js";

const USER_SETTINGS_KEY = "sc_user_settings";

interface UserSettings {
  appearance: {
    alwaysShowSendButton: boolean;
    timeFormat: string;
    use24HourFormat: boolean;
  };
  privacy: {
    sendTypingIndicators: boolean;
  };
  notifications: {
    enableSounds: boolean;
    enablePushNotifications: boolean;
    enableDesktopNotifications: boolean;
    soundVolume: number;
    mentionSound: string;
    messageSound: string;
    muteAllSounds: boolean;
    onlyMentionsAndPMs: boolean;
    respectDndStatus: boolean;
  };
}

interface UserSettingsContextType {
  userSettings: () => UserSettings;
  setUserSettings: (settings: UserSettings) => void;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  toggleAlwaysShowSendButton: () => void;
  toggleTimeFormat: () => void;
  toggleSendTypingIndicators: () => void;
  updateNotificationSettings: (settings: Partial<UserSettings['notifications']>) => void;
  appearance: () => {
    alwaysShowSendButton: boolean;
    timeFormat: string;
    use24HourFormat: boolean;
  };
  privacy: () => {
    sendTypingIndicators: boolean;
  };
  notifications: () => {
    enableSounds: boolean;
    enablePushNotifications: boolean;
    enableDesktopNotifications: boolean;
    soundVolume: number;
    mentionSound: string;
    messageSound: string;
    muteAllSounds: boolean;
    onlyMentionsAndPMs: boolean;
    respectDndStatus: boolean;
  };
}

const defaultUserSettings: UserSettings = {
  appearance: {
    alwaysShowSendButton: false,
    timeFormat: "12h",
    use24HourFormat: false,
  },
  privacy: {
    sendTypingIndicators: true,
  },
  notifications: {
    enableSounds: true,
    enablePushNotifications: true,
    enableDesktopNotifications: true,
    soundVolume: 0.7,
    mentionSound: "mention",
    messageSound: "message",
    muteAllSounds: false,
    onlyMentionsAndPMs: false,
    respectDndStatus: true,
  },
};

const UserSettingsContext = createContext<UserSettingsContextType>();

export const UserSettingsProvider: ParentComponent = (props) => {
  const getSavedUserSettings = (): UserSettings => {
    try {
      const savedSettings = localStorage.getItem(USER_SETTINGS_KEY);
      return savedSettings ? JSON.parse(savedSettings) : defaultUserSettings;
    } catch {
      return defaultUserSettings;
    }
  };

  const [userSettings, setUserSettings] = createSignal<UserSettings>(getSavedUserSettings());

  createEffect(() => {
    try {
      localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(userSettings()));
    } catch {
      console.warn("Could not save user settings to localStorage.");
    }
  });

  const updateUserSettings = (settings: Partial<UserSettings>) => {
    setUserSettings((prev) => {
      return {
        ...prev,
        ...settings,
      };
    });
  };

  const toggleAlwaysShowSendButton = () => {
    setUserSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        alwaysShowSendButton: !prev.appearance.alwaysShowSendButton,
      },
    }));
  };

 const toggleTimeFormat = () => {
    setUserSettings((prev) => {
      const newTimeFormat = prev.appearance.timeFormat === "12h" ? "24h" : "12h";
      const newUse24HourFormat = newTimeFormat === "24h";
      
      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          timeFormat: newTimeFormat,
          use24HourFormat: newUse24HourFormat,
        },
      };
    });
  };

  const toggleSendTypingIndicators = () => {
    setUserSettings((prev) => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        sendTypingIndicators: !prev.privacy.sendTypingIndicators,
      },
    }));
  };

  const updateNotificationSettings = (settings: Partial<UserSettings['notifications']>) => {
    setUserSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        ...settings,
      },
    }));
  };

  return (
    <UserSettingsContext.Provider
      value={{
        userSettings,
        setUserSettings,
        updateUserSettings,
        toggleAlwaysShowSendButton,
        toggleTimeFormat,
        toggleSendTypingIndicators,
        updateNotificationSettings,
        appearance: () => userSettings().appearance,
        privacy: () => userSettings().privacy,
        notifications: () => userSettings().notifications,
      }}
    >
      {props.children}
    </UserSettingsContext.Provider>
  );
};

export const useUserSettings = () => {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error("useUserSettings must be used within a UserSettingsProvider");
  }
  return context;
};