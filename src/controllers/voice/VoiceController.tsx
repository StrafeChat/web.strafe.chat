import React, { createContext, useContext, useState } from 'react';
import { VoiceManager, VoiceConnection } from "@strafechat/strafe.js";
import { useClient } from '@/hooks/';
import { Room, Space } from "@strafechat/strafe.js";

interface VoiceControllerContextType {
  isVoiceMuted: boolean;
  toggleVoiceMute: () => void;
  muteVoice: () => void;
  unmuteVoice: () => void;

  manager: VoiceManager | null;
  connection: VoiceConnection | null;
  setConnection: (connection: VoiceConnection) => void;
  room: Room | null;
  setRoom: (room: Room) => void;
}

export const VoiceControllerContext = createContext<VoiceControllerContextType>({
  isVoiceMuted: false,
  manager: null,
  connection: null,
  room: null,
  toggleVoiceMute: () => {},
  muteVoice: () => {},
  unmuteVoice: () => {},
  setConnection: () => {},
  setRoom: () => {}
});

export default function VoiceController({ children }: { children: JSX.Element }) {
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [connection, setVoiceConnection] = useState<VoiceConnection | null>(null);

  const [users, setUsers] = useState([]);
  const [room, setStrafeRoom] = useState<Room | null>(null);

  const { client } = useClient();
  const manager = client?.voice;

  const toggleVoiceMute = () => {


  }
  const muteVoice = () => {

  }
  const unmuteVoice = () => {

  }
  const setConnection = (con: VoiceConnection) => {
    setVoiceConnection(con);
  }
  const setRoom = (r: Room) => {
    setStrafeRoom(r);
  }

  return (
    <VoiceControllerContext.Provider value={{
       isVoiceMuted,
       toggleVoiceMute,
       muteVoice,
       unmuteVoice,
       manager: manager || null,
       connection,
       setConnection,
       room,
       setRoom
      }}>
        {children}
    </VoiceControllerContext.Provider>
  )
}
/*
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
};*/
