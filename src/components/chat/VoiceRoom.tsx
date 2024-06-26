import React, { useEffect, useState } from 'react';
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, Room, RoomEvent, LocalAudioTrack } from 'livekit-client';
import { KrispNoiseFilter } from '@livekit/krisp-noise-filter';
import { VoiceHeader } from './voice/VoiceHeader'; // Adjust path as per your project structure
import { useTranslation } from 'react-i18next';
import { useVisualStableUpdate } from "@livekit/components-react";

import { useClient, useVoice } from '@/hooks/';

export default function VoiceRoom(props: {
  space: any; // Adjust the type of space according to your application
  room: any; // Adjust the type of room according to your application
  hidden: boolean;
}) {
  const [token, setToken] = useState('');

  const { client } = useClient();
  const { connection, setConnection, setRoom, isVoiceMuted } = useVoice();

  const [isKrispSupported, setIsKrispSupported] = useState(false);
  const [voiceRoom, setVoiceRoom] = useState<Room | null>(null);
  const [krispProcessor, setKrispProcessor] = useState<any>(null); // State for Krisp processor

  const { t } = useTranslation();

  /*useEffect(() => {
    setVoiceRoom(new Room());
    const loadKrispAndCheckSupport = async () => {
      try {
        const { KrispNoiseFilter, isKrispNoiseFilterSupported } = await import(
          '@livekit/krisp-noise-filter'
        );
        setIsKrispSupported(true);

        const supported = await isKrispNoiseFilterSupported();
        if (!supported) {
          console.warn('Enhanced noise filter is not supported on this browser.');
          return;
        }

        const processor = await KrispNoiseFilter();
        console.log('KrispNoiseFilter initialized successfully.');
        setKrispProcessor(processor); // Initialize Krisp processor
      } catch (error) {
        console.error('Failed to load KrispNoiseFilter:', error);
        setIsKrispSupported(false);
      }
    };

    // voiceRoom!.on("trackMuted", () => {
    //   muteVoice();
    // })

    loadKrispAndCheckSupport();
  }, []);*/

  /*useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API}/portal/join`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: localStorage.getItem('token')!,
            },
            body: JSON.stringify({
              roomId: props.room.id,
            }),
          }
        );
        const data = await res.json();
        setToken(data.token);
      } catch (e) {
        console.error(e);
      }
    };

    fetchToken();
  }, [props.room.id]);*/

  useEffect(() => {
    // TODO: close connection if channel switch
    if (props.room.id === connection?.room.name) return;
    
    client!.voice.joinChannel(props.room.id).then(connection => {
      setConnection(connection);
      setRoom(props.room);
    });
  }, [props.room.id]);

  const handleRoomConnect = async (liveKitRoom: Room) => {
    console.log('Room connected');
    
    liveKitRoom.on(RoomEvent.LocalTrackPublished, async (trackPublication) => {
      console.log('LocalTrackPublished event received');
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0]; // todo: device chooser
      const localAudioTrack = new LocalAudioTrack(audioTrack);
      localAudioTrack.on("muted", () =>{
        console.log("muted")
      })
      if (!isVoiceMuted) {
        await liveKitRoom.localParticipant.publishTrack(localAudioTrack);
      }
    } catch (e) {
      console.error('Error accessing user media:', e);
    }
  };

  if (!token || !isKrispSupported) {
    return (
      <>
        <VoiceHeader type="server" name={`${props.room?.name}`} />
        <h1>Loading..</h1>
      </>
    );
  }

  return (
    <>
      <VoiceHeader type="server" name={`${props.room?.name}`} />
      <StrafeVoiceCall></StrafeVoiceCall>
    </>
  );
}

function StrafeVoiceCall() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: true }
  );
  const updated = useVisualStableUpdate(tracks, 4);

  return (
    <GridLayout tracks={updated} style={{ height: '85%' }}>
      <ParticipantTile />
    </GridLayout>
  );
}


/*<LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        data-lk-theme="default"
        onConnected={() => handleRoomConnect(voiceRoom!)}
        style={{ background: 'black' }}
      >
        <StrafeVoiceCall />
        <RoomAudioRenderer />
        <ControlBar variation="minimal" saveUserChoices={true} />
      </LiveKitRoom>*/
