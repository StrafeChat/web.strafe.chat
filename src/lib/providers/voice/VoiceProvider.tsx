import {
	createContext,
	ParentComponent,
	useContext,
	createSignal,
	Accessor
} from "solid-js"

import { useAuth } from "../auth/AuthProvider"
import { AudioCaptureOptions, DisconnectReason, LocalTrackPublication, ParticipantEvent, RemoteParticipant, RemoteTrack, RemoteTrackPublication, Room, RoomEvent, Track, VideoCaptureOptions } from "livekit-client";
import { LIVEKIT_URL } from "../../../constants";

export enum VoiceState {
	DISCONNECTED, // order is important
	ERROR,

	CONNECTING,
	CONNECTED,
}

type VoiceContextType = {
	connect: (roomId: string) => Promise<void>;
	disconnect: () => Promise<void>;

	enableCamera: (enable: boolean, options?: VideoCaptureOptions) => Promise<void>;
	enableMicrophone: (enable: boolean, options?: AudioCaptureOptions) => Promise<void>;
	enableScreenShare: (enable: boolean) => Promise<void>;
	setDeafened: (deafened: boolean) => void;
	enabledMedia: () => { video: boolean, audio: boolean, screenShare: boolean, deafened: boolean };

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
	
	// Reactive signals for media states
	const [isCameraEnabled, setIsCameraEnabled] = createSignal(false);
	const [isMicrophoneEnabled, setIsMicrophoneEnabled] = createSignal(false);
	const [isScreenShareEnabled, setIsScreenShareEnabled] = createSignal(false);
	const [isDeafened, setIsDeafened] = createSignal(false);

	var token: string, lvRoom: Room;

	const connect = async (roomId: string) => {
		try {
			console.log("[VoiceProvider] Connecting to voice room:", roomId);
			setRoom(roomId);

			setState(VoiceState.CONNECTING);
			token = await getJoinToken(roomId);

			lvRoom = new Room();
			setLivekitRoom(lvRoom);
			await lvRoom.connect(LIVEKIT_URL, token);
			setupListeners();

			// Initialize media states
			const p = lvRoom.localParticipant;
			setIsCameraEnabled(p.isCameraEnabled);
			setIsMicrophoneEnabled(p.isMicrophoneEnabled);
			setIsScreenShareEnabled(p.isScreenShareEnabled);

			setState(VoiceState.CONNECTED);
			console.log("[VoiceProvider] Successfully connected to voice room:", roomId);
		} catch(e) {
			console.error("[VoiceProvider] Failed to connect to voice room:", e);
			setState(VoiceState.ERROR);
			setRoom("")
		}
	}

	const pubElements = new Map<string, HTMLElement>();
	var audioCon!: HTMLDivElement;

	const enableCamera = async (enable: boolean, options?: VideoCaptureOptions) => {
		const p = lvRoom.localParticipant;
		const track = await p.setCameraEnabled(enable, options);
		if (track) setLocalTrack(track);
		// Update reactive signal
		setIsCameraEnabled(p.isCameraEnabled);
	}
	const enableMicrophone = async (
	enable: boolean,
	options?: AudioCaptureOptions
) => {
	const p = lvRoom.localParticipant;

	// Merge your provided options with default noise suppression
	const micOptions: AudioCaptureOptions = {
		noiseSuppression: true,
		echoCancellation: true,
		autoGainControl: true,   
		...options               
	};

	await p.setMicrophoneEnabled(enable, micOptions);

	// Update reactive signal
	setIsMicrophoneEnabled(p.isMicrophoneEnabled);
   };
  
	const enableScreenShare = async (enable: boolean) => {
		const p = lvRoom.localParticipant;
		await p.setScreenShareEnabled(enable);
		// Update reactive signal
		setIsScreenShareEnabled(p.isScreenShareEnabled);
	}

	const setDeafened = (deafened: boolean) => {
		setIsDeafened(deafened);
		// Mute/unmute all remote audio tracks by setting volume on attached elements
		if (lvRoom) {
			lvRoom.remoteParticipants.forEach(participant => {
				participant.audioTrackPublications.forEach(publication => {
					if (publication.track && publication.isSubscribed) {
						// Get all attached audio elements for this track
						const audioElements = publication.track.attachedElements as HTMLAudioElement[];
						audioElements.forEach(element => {
							if (element instanceof HTMLAudioElement) {
								// Store original volume if not already stored
							const trackId = publication.track!.sid;
							if (trackId && !originalVolumes.has(trackId)) {
								originalVolumes.set(trackId, element.volume);
							}
							// Set volume to 0 when deafened, restore original when not deafened
							element.volume = deafened ? 0 : (trackId ? originalVolumes.get(trackId) || 1.0 : 1.0);
							}
						});
					}
				});
			});
		}
	}

	// Store original volumes to restore them properly
	const originalVolumes = new Map<string, number>();

	const restoreAudioVolumes = () => {
		if (lvRoom && !isDeafened()) {
			lvRoom.remoteParticipants.forEach(participant => {
				participant.audioTrackPublications.forEach(publication => {
					if (publication.track && publication.isSubscribed) {
						const trackId = publication.track.sid;
						if (!trackId) return;
						const originalVolume = originalVolumes.get(trackId) || 1.0;
						// Get all attached audio elements for this track
						const audioElements = publication.track.attachedElements as HTMLAudioElement[];
						audioElements.forEach(element => {
							if (element instanceof HTMLAudioElement) {
								element.volume = originalVolume;
							}
						});
					}
				});
			});
		}
	}

	const enabledMedia = () => {
		return {
			video: isCameraEnabled(),
			audio: isMicrophoneEnabled(),
			screenShare: isScreenShareEnabled(),
			deafened: isDeafened(),
		}
	}

	const disconnectedListener = (reason?: DisconnectReason) => {
		console.log("[VoiceProvider] Voice call disconnected:", reason);
		console.trace("[VoiceProvider] Disconnect stack trace:");
		// Reset state when disconnected
		setState(VoiceState.DISCONNECTED);
		setRoom("");
		setLocalTrack(null);
		setLivekitRoom(null);
		// Reset media states
		setIsCameraEnabled(false);
		setIsMicrophoneEnabled(false);
		setIsScreenShareEnabled(false);
		setIsDeafened(false);
		// Clear original volumes map
		originalVolumes.clear();
	}

	const joinListener = (p: RemoteParticipant) => {
		console.log(p);
		if (p.isLocal) return; // don't listen to local audio
		p.on(ParticipantEvent.TrackSubscribed, (track: RemoteTrack) => {
			if (track.kind !== Track.Kind.Audio) return;

			const element = track.attach();

			audioCon.appendChild(element);
			pubElements.set(track.sid!, element);
		});
		p.on(ParticipantEvent.TrackPublished, (pub: RemoteTrackPublication) => {
			const track = pub.track;
			if (!track) return;
			if (track.kind !== Track.Kind.Audio) return;

			const element = track.attach();

			audioCon.appendChild(element);
			pubElements.set(track.sid!, element);
		})

		p.on(ParticipantEvent.TrackUnsubscribed, (track: RemoteTrack) => {
			track.detach();
			if (!pubElements.has(track.sid!)) return;
			const e = pubElements.get(track.sid!);
			e?.remove();
		});
		p.on(ParticipantEvent.TrackUnpublished, (pub: RemoteTrackPublication) => {
			const track = pub.track;
			if (!track) return;
			track.detach();
			if (!pubElements.has(track.sid!)) return;
			const e = pubElements.get(track.sid!);
			e?.remove();
		})
	}

	const setupListeners = () => {
		console.log("setting up listeners");
		lvRoom.on(RoomEvent.Disconnected, disconnectedListener);
		lvRoom.on(RoomEvent.ParticipantConnected, joinListener);

		for (const [_k, v] of lvRoom.remoteParticipants) { // setup listeners for participants already in the room
			joinListener(v);
		}
		
		// Handle track subscription to store original volumes
		lvRoom.on(RoomEvent.TrackSubscribed, (track, _publication, _participant) => {
			if (track.kind === 'audio') {
				track.on("elementAttached", () => {
					const audioElements = track.attachedElements as HTMLAudioElement[];
					audioElements.forEach(element => {
						if (element instanceof HTMLAudioElement) {
							// Store original volume when track is subscribed
							const trackId = track.sid;
							if (trackId && !originalVolumes.has(trackId)) {
								originalVolumes.set(trackId, element.volume || 1.0);
							}
							// Apply deafen state if currently deafened
							if (isDeafened()) {
								element.volume = 0;
							}
						}
					});
				});
				// Wait for the track to be attached to DOM elements
				/*setTimeout(() => {
					const audioElements = track.attachedElements as HTMLAudioElement[];
					audioElements.forEach(element => {
						if (element instanceof HTMLAudioElement) {
							// Store original volume when track is subscribed
						const trackId = track.sid;
						if (trackId && !originalVolumes.has(trackId)) {
							originalVolumes.set(trackId, element.volume || 1.0);
						}
							// Apply deafen state if currently deafened
							if (isDeafened()) {
								element.volume = 0;
							}
						}
					});
				}, 100); // Small delay to ensure elements are attached*/
			}
		});
	}

	const disconnect = async () => {
		console.log("[VoiceProvider] Disconnect called");
		console.trace("[VoiceProvider] Disconnect stack trace:");
		// Restore audio volumes before disconnecting
		restoreAudioVolumes();
		if (lvRoom && lvRoom.state === 'connected') {
			console.log("[VoiceProvider] Disconnecting from LiveKit room");
			await lvRoom.disconnect();
		}
		// Manually trigger state reset in case the event doesn't fire
		setState(VoiceState.DISCONNECTED);
		setRoom("");
		setLocalTrack(null);
		setLivekitRoom(null);
		// Reset media states
		setIsCameraEnabled(false);
		setIsMicrophoneEnabled(false);
		setIsScreenShareEnabled(false);
		setIsDeafened(false);
		// Clear original volumes map
		originalVolumes.clear();
		console.log("[VoiceProvider] Voice call disconnected successfully");
	}

	const setDevice = async (device: MediaDeviceInfo) => {
		if (device.kind === "audioinput") {
			setAudio(device);
			if (lvRoom) {
				await lvRoom.switchActiveDevice('audioinput', device.deviceId);
			}
		} else if (device.kind === "videoinput") {
			setVideo(device);
			if (lvRoom) {
				await lvRoom.switchActiveDevice('videoinput', device.deviceId);
			}
		} else if (device.kind === "audiooutput") {
			// TODO:
		}
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
				enableScreenShare,
				setDeafened,
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
			<div ref={audioCon}>

			</div>
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