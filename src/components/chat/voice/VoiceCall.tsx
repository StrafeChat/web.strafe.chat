import { createContext, useContext } from "react";

export const VoiceCallContext = createContext({
});

export const useVoiceCall = () => {
  return useContext(VoiceCallContext);
}

export default function VoiceCallController({ children }: { children: JSX.Element }) {
  return (
    <VoiceCallContext.Provider value={{

    }}>
      {children}
    </VoiceCallContext.Provider>
  );
}