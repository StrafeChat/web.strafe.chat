import { useForceUpdate } from '@/hooks';
import React, { createContext, useContext, useState } from 'react';

interface VoiceControllerContextType {
  isVoiceMuted: boolean;
  toggleVoiceMute: () => void;
  muteVoice: () => void;
  unmuteVoice: () => void;
}

const VoiceControllerContext = createContext<VoiceControllerContextType>({
  isVoiceMuted: false,
  toggleVoiceMute: () => {},
  muteVoice: () => {},
  unmuteVoice: () => {},
});

export const useVoiceController = () => useContext(VoiceControllerContext);

export const VoiceControllerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const forceUpdate = useForceUpdate();

  const toggleVoiceMute = () => {
    setIsVoiceMuted(prevState => !prevState);
    forceUpdate();
  };

  const muteVoice = () => {
    setIsVoiceMuted(true);
    forceUpdate();
  };

  const unmuteVoice = () => {
    setIsVoiceMuted(false);
    forceUpdate();
  };

  return (
    <VoiceControllerContext.Provider value={{ isVoiceMuted, toggleVoiceMute, muteVoice, unmuteVoice }}>
      {children}
    </VoiceControllerContext.Provider>
  );
};