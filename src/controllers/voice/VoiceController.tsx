import React, { createContext, useContext, useState, useEffect } from 'react';
import { VoiceManager, VoiceConnection } from "@strafechat/strafe.js";
import { useClient } from '@/hooks/';
import { Room, Space } from "@strafechat/strafe.js";
import { Participant } from "livekit-client";

interface VoiceControllerContextType {
  isVoiceMuted: boolean;
  toggleVoiceMute: () => void;
  muteVoice: () => void;
  unmuteVoice: () => void;

  manager: VoiceManager | null;
  connection: VoiceConnection | null;
  setConnection: (connection: VoiceConnection | null) => void;
  room: Room | null;
  setRoom: (room: Room) => void;

  users: (Participant)[];
  localParticipant: Participant | null;
  localUser: string;
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
  setRoom: () => {},
  users: [],
  localParticipant: null,
  localUser: "",
});

export default function VoiceController({ children }: { children: JSX.Element }) {
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [connection, setVoiceConnection] = useState<VoiceConnection | null>(null);

  const [users, setUsers] = useState<Participant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  const [localUser, setLocalUser] = useState<string>("");
  const [room, setStrafeRoom] = useState<Room | null>(null);

  const { client } = useClient();
  const manager = client?.voice;

  const toggleVoiceMute = () => {


  }
  const muteVoice = () => {

  }
  const unmuteVoice = () => {

  }
  const setConnection = (con: VoiceConnection | null) => {
    setVoiceConnection(con);
  }
  const setRoom = (r: Room) => {
    setStrafeRoom(r);
  }

  useEffect(() => {
    console.log("local participant changed", localParticipant?.identity);
  }, [localParticipant]);

  useEffect(() => {
    if (!connection) {
      // TODO: reset values
      return;
    }

    setLocalUser(connection.room.localParticipant.identity);
    setLocalParticipant(connection.room.localParticipant);

    connection.on("userJoin", user => {
      console.log("user joined", user)
      users.push(user);
      setUsers(users);
    });
  }, [connection]);

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
       setRoom,
       users,
       localParticipant,
       localUser
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
