import { ParentComponent, createContext, useContext } from "solid-js";
import { createStore } from "solid-js/store";

interface SettingsState {
  activeSection: string;
  isOpen: boolean;
}

interface SettingsContextValue {
  state: SettingsState;
  setActiveSection: (section: string) => void;
  setIsOpen: (isOpen: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue>();

export const SettingsProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<SettingsState>({
    activeSection: "account",
    isOpen: false,
  });

  const setActiveSection = (section: string) => {
    setState("activeSection", section);
  };

  const setIsOpen = (isOpen: boolean) => {
    setState("isOpen", isOpen);
  };

  return (
    <SettingsContext.Provider
      value={{
        state,
        setActiveSection,
        setIsOpen,
      }}
    >
      {props.children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
