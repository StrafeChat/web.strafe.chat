import React, { createContext, useState, useEffect } from 'react';
import { VoiceManager, VoiceConnection, Space, MemberManager } from "@strafechat/strafe.js";
import { useClient, useModal, useForceUpdate } from '@/hooks/';
import { Room, Member } from "@strafechat/strafe.js";
import { Participant, LocalParticipant } from "livekit-client";
import { DeviceChooser } from '@/components/chat/voice/DeviceChooser';

export interface RoomInfo {
  room: Room | null;
  space: Space | null;
}

interface VoiceControllerContextType {
  isVoiceMuted: boolean;
  toggleVoiceMute: () => void;
  muteVoice: () => void;
  unmuteVoice: () => void;

  manager: VoiceManager | null;
  voiceUserMap: Map<string, Member[]> | null;

  // current call-specific values
  connection: VoiceConnection | null;
  setConnection: (connection: VoiceConnection | null) => void;
  roomInfo: RoomInfo,
  setRoomInfo: (info: RoomInfo) => void;

  disconnect: () => void;

  users: (Participant)[];
  localParticipant: LocalParticipant | null;
  localUser: string;
}

export const VoiceControllerContext = createContext<VoiceControllerContextType>({
  isVoiceMuted: false,
  manager: null,
  connection: null,
  roomInfo: { room: null, space: null },
  setRoomInfo: () => {},
  toggleVoiceMute: () => {},
  muteVoice: () => {},
  unmuteVoice: () => {},
  setConnection: () => {},
  disconnect: () => {},
  users: [],
  voiceUserMap: null,
  localParticipant: null,
  localUser: "",
});

export default function VoiceController({ children }: { children: JSX.Element }) {
  const { openCallbackModal, openModal } = useModal();

  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [connection, setVoiceConnection] = useState<VoiceConnection | null>(null);

  const [users, setUsers] = useState<Participant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [localUser, setLocalUser] = useState<string>("");
  const [roomInfo, setRoomInfoState] = useState<RoomInfo>({ room: null, space: null });

  const [voiceUserMap, setVoiceUserMap] = useState<Map<string, Member[]>>(new Map());

  const forceUpdate = useForceUpdate();

  const { client } = useClient();
  const manager = client?.voice;

  const listenVoiceJoin = (data: any) => {
    const newMap = new Map(voiceUserMap);
    newMap.set(data.room, client!.spaces.get(data.space_id)?.rooms.get(data.room)?.participants!);
    setVoiceUserMap(newMap);
  }
  const listenVoiceLeave = (data: any) => {
    const newMap = new Map(voiceUserMap);
    newMap.set(data.room, client!.spaces.get(data.space_id)?.rooms.get(data.room)?.participants!);
    setVoiceUserMap(newMap);
  }
  const listenReady = () => {
    const newMap = new Map(voiceUserMap);
    client!.spaces.forEach((space) => {
      space.rooms.forEach((room) => {
        console.log(room);
        if (room.type !== Room.Type.VOICE) return;
        newMap.set(room.id, room.participants!);
      });
    });
    if (newMap.size === 0) return;
    setVoiceUserMap(newMap);
  }

  useEffect(() => {
    client?.on("voiceJoin", listenVoiceJoin);
    client?.on("voiceLeave", listenVoiceLeave);
    client?.on("ready", listenReady);

    if ((client?.spaces.size || 0) != 0) {
      listenReady(); // call ready if client is already ready
    }

    return () => {
      client?.off("voiceJoin", listenVoiceJoin);
      client?.off("voiceLeave", listenVoiceLeave);
      client?.off("ready", listenReady);
    }
  }, [client])


  const setRoomInfo = (info: RoomInfo) => {
    setRoomInfoState(info);
  }

  const toggleVoiceMute = () => {
    if (isVoiceMuted) {
      unmuteVoice();
    } else {
      muteVoice();
    }
  }
  const muteVoice = () => {
    if (!connection) return;
    connection.mute();
    setIsVoiceMuted(true);
  }
  const unmuteVoice = () => {
    if (!connection) return;
    connection.unmute();
    setIsVoiceMuted(false);
  }

  const setConnection = (con: VoiceConnection | null) => {
    setVoiceConnection(con);
  }
  const disconnect = () => {
    if (!connection) return;
    connection.disconnect();
    setConnection(null);
  }

  useEffect(() => {
    console.log("local participant changed", localParticipant?.identity);
    setLocalUser(localParticipant?.identity || "");
    return () => {
      setLocalUser("");
    }
  }, [localParticipant]);

  useEffect(() => {
    console.log("local user changed context", localUser);
  }, [localUser]);

  useEffect(() => {
    if (!connection) {
      // TODO: reset values
      return;
    }

    setIsVoiceMuted(connection.isMuted());
    
    const userJoinListener = (user: Participant) => {
      console.log("user joined", user);
      console.log("users", [...users, user]);
      setUsers((prev) => [...prev, user]);
    }
    
    connection.on("userJoin", userJoinListener);
    
    setLocalParticipant(connection.room.localParticipant);

    return () => {
      connection.off("userJoin", userJoinListener)
    }
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
       users,
       localParticipant,
       localUser,
       disconnect,
       voiceUserMap,
       roomInfo, setRoomInfo
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
