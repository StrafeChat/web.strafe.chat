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
}

interface UserSettingsContextType {
  userSettings: () => UserSettings;
  setUserSettings: (settings: UserSettings) => void;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  toggleAlwaysShowSendButton: () => void;
  toggleTimeFormat: () => void;
  appearance: () => {
    alwaysShowSendButton: boolean;
    timeFormat: string;
    use24HourFormat: boolean;
  };
}

const defaultUserSettings: UserSettings = {
  appearance: {
    alwaysShowSendButton: false,
    timeFormat: "12h",
    use24HourFormat: false,
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

  return (
    <UserSettingsContext.Provider
      value={{
        userSettings,
        setUserSettings,
        updateUserSettings,
        toggleAlwaysShowSendButton,
        toggleTimeFormat,
        appearance: () => userSettings().appearance,
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