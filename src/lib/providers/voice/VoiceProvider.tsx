import {
	createContext,
	ParentComponent,
	useContext,
	createSignal,
	Accessor
} from "solid-js"

import { useAuth } from "../auth/AuthProvider"
import { AudioCaptureOptions, DisconnectReason, LocalTrackPublication, Room, RoomEvent, TrackPublishOptions, VideoCaptureOptions } from "livekit-client";
import { LIVEKIT_URL } from "../../../constants";

export enum VoiceState {
	DISCONNECTED,
	CONNECTING,
	CONNECTED,
	ERROR
}

type VoiceContextType = {
	connect: (roomId: string) => Promise<void>;
	disconnect: () => Promise<void>;

	enableCamera: (enable: boolean, options?: VideoCaptureOptions) => Promise<void>;
	enableMicrophone: (enable: boolean, options?: AudioCaptureOptions) => Promise<void>;
	enabledMedia: () => { video: boolean, audio: boolean };

	setDevice: (device: MediaDeviceInfo) => void;
	currentDevices: {
		audio: Accessor<MediaDeviceInfo | null>;
		video: Accessor<MediaDeviceInfo | null>;
	};

	state: Accessor<VoiceState>;
	room: Accessor<String>;

	livekitRoom: Accessor<Room | null>;

	localTrack: Accessor<LocalTrackPublication | null>;
}

const VoiceContext = createContext<VoiceContextType>()

export const VoiceProvider: ParentComponent = (props) => {
	const { getJoinToken } = useAuth();
	const [state, setState] = createSignal<VoiceState>(VoiceState.DISCONNECTED)
	const [room, setRoom] = createSignal("");
	const [localTrack, setLocalTrack] = createSignal<LocalTrackPublication | null>(null);
	const [livekitRoom, setLivekitRoom] = createSignal<Room | null>(null);
	const [audio, setAudio] = createSignal<MediaDeviceInfo | null>(null);
	const [video, setVideo] = createSignal<MediaDeviceInfo | null>(null);

	var token: string, lvRoom: Room;

	const connect = async (roomId: string) => {
		try {
			setRoom(roomId);

			setState(VoiceState.CONNECTING);
			token = await getJoinToken(roomId);

			lvRoom = new Room();
			setLivekitRoom(lvRoom);
			await lvRoom.connect(LIVEKIT_URL, token);
			setupListeners();

			setState(VoiceState.CONNECTED);
		} catch(e) {
			console.error(e);
			setState(VoiceState.ERROR);
			setRoom("")
		}
	}

	const enableCamera = async (enable: boolean, options?: VideoCaptureOptions) => {
		const p = lvRoom.localParticipant;
		const track = await p.setCameraEnabled(enable, options);
		if (track) setLocalTrack(track);
	}
	const enableMicrophone = async (enable: boolean, options?: AudioCaptureOptions) => {
		const p = lvRoom.localParticipant;
		await p.setMicrophoneEnabled(enable, options);
	}
	const enabledMedia = () => {
		if (!lvRoom) return { video: false, audio: false }
		const p = lvRoom.localParticipant;
		
		return {
			video: p.isCameraEnabled,
			audio: p.isMicrophoneEnabled,
		}
	}

	const disconnectedListener = (reason?: DisconnectReason) => {
		console.log("Disconnected: ", reason);
	}

	const setupListeners = () => {
		lvRoom.on(RoomEvent.Disconnected, disconnectedListener)
		/*p.on(ParticipantEvent.TrackMuted, (pub) => {
			var allMuted = true;
			for (const [_k, v] of p.trackPublications) {
				if (!v.isMuted) allMuted = false;
			}
			const current = enabledMedia();
			const tKind = pub.track?.kind;
			if (!tKind) return;
			const kind = (tKind === Track.Kind.Audio) ? "audio" : "video";
			const currentVal = current[kind];
			
			if (allMuted && currentVal) {
				const newVal = { ...current }
				newVal[kind] = false;
				setEnabledMedia(newVal);
			}
		});
		p.on(ParticipantEvent.TrackUnmuted, (pub) => {
			var allUnmuted = true;
			for (const [_k, v] of p.trackPublications) {
				if (v.isMuted) allUnmuted = false;
			}
			const current = enabledMedia();
			const tKind = pub.track?.kind;
			if (!tKind) return;
			const kind = (tKind === Track.Kind.Audio) ? "audio" : "video";
			const currentVal = current[kind];

			if (allUnmuted && currentVal) {
				const newVal = { ...current }
				newVal[kind] = true;
				setEnabledMedia(newVal);
			}
		});*/
	}

	const setDevice = (device: MediaDeviceInfo) => {
		if (device.kind === "audioinput") {
			setAudio(device);
		} else if (device.kind === "videoinput") {
			setVideo(device);
		} else if (device.kind === "audiooutput") {
			// TODO:
		}
	}

	const disconnect = async () => { // TODO:
		lvRoom.disconnect();
	}

	return (
		<VoiceContext.Provider
			value={{
				connect,
				state,
				room,
				disconnect,
				enableCamera,
				enableMicrophone,
				enabledMedia,
				setDevice,
				currentDevices: {
					audio,
					video
				},
				localTrack,
				livekitRoom
			}}
		>
			{props.children}
		</VoiceContext.Provider>
	)
}

export const useVoice = () => {
	const context = useContext(VoiceContext);
	if (!context) {
		throw new Error("useVoice must be used within a VoiceProvider");
	}
	return context;
}