import { Participant, ParticipantEvent, RemoteTrack, RemoteTrackPublication, Track, TrackPublication } from "livekit-client";
import { Component, createEffect, createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { Avatar } from "../common/Avatar";

type ParticipantProps = {
	p: Participant,
	isLocal: boolean,
	onFocus?: () => void
}

export const ParticipantElement: Component<ParticipantProps> = (props) => {
	const { user } = useAuth();
	const { getUser } = useCache();

	const p = props.p;
	const userId = p.identity;

	const pubElements = new Map<string, HTMLElement>();

	const MIN_DECIBELS = -45;

	const [soundDetected, setSoundDetected] = createSignal(false);

	const getStrafeUser = () => {
		if (user()?.id === userId) {
			return user();
		}

		const u = getUser(userId);
		if (!u) {
			console.error(userId, p);
			throw Error("user not found");
		}
		return u;
	}
	const pUser = getStrafeUser();

	console.log(props);

	var mediaCon!: HTMLDivElement;

	const onPublish = (pub: TrackPublication) => {
		const track = pub.track;
		if (!track) return;
		if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
			// attach it to a new HTMLVideoElement or HTMLAudioElement
			const element = track.attach();
			if (!!props.isLocal && track.kind === Track.Kind.Audio) {
				// Mute local audio to prevent feedback
				element.muted = true;
			}
			if (track.kind === Track.Kind.Audio) {
				element.muted = true;
				setupSpeakingIndicator(track as Track<Track.Kind.Audio>);
			}
			// Style video elements properly
			if (track.kind === Track.Kind.Video) {
				element.style.width = '100%';
				element.style.height = '100%';
				element.style.objectFit = 'cover';
				// Check if this is a screen share track
				if (track.source === Track.Source.ScreenShare) {
					element.style.objectFit = 'contain';
					element.classList.add('screen-share-track');
				}
			}
			mediaCon.appendChild(element);
			pubElements.set(pub.trackSid, element);
		}
	}

	const setupSpeakingIndicator = (track: Track<Track.Kind.Audio>) => {
		const stream = new MediaStream();
		stream.addTrack(track.mediaStreamTrack)

		const audioCtx = new AudioContext();
		const analyser = audioCtx.createAnalyser();

		const source = audioCtx.createMediaStreamSource(stream);
		source.connect(analyser);
		analyser.minDecibels = MIN_DECIBELS;

		const bufferLength = analyser.frequencyBinCount;
		const domainData = new Uint8Array(bufferLength);

		setSoundDetected(false);

		const detectSound = () => {
			analyser.getByteFrequencyData(domainData);

			for (let i = 0; i < bufferLength; i++) {
				const value = domainData[i];
				if (value > 0) {
					setSoundDetected(true)
				} else {
					setSoundDetected(false);
				}
			}

			window.requestAnimationFrame(detectSound);
		};

		window.requestAnimationFrame(detectSound);
	}

	const onSubscribe = (track: RemoteTrack, pub: RemoteTrackPublication) => {
		if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
			// attach it to a new HTMLVideoElement or HTMLAudioElement
			const element = track.attach();
			if (track.kind === Track.Kind.Audio) {
				// Ensure remote audio is muted to prevent double audio playback
				element.muted = true;
				setupSpeakingIndicator(track as Track<Track.Kind.Audio>);
			}
			// Style video elements properly
			if (track.kind === Track.Kind.Video) {
				element.style.width = '100%';
				element.style.height = '100%';
				element.style.objectFit = 'cover';
				// Check if this is a screen share track
				if (track.source === Track.Source.ScreenShare) {
					element.style.objectFit = 'contain';
					element.classList.add('screen-share-track');
				}
			}
			mediaCon.appendChild(element);
			pubElements.set(pub.trackSid, element);
		}
	}
	const onUnsubscribe = (track: RemoteTrack, pub: RemoteTrackPublication) => {
		track.detach();
		if (!pubElements.has(pub.trackSid)) return;
		const e = pubElements.get(pub.trackSid);
		e?.remove();
	}
	const onLocalUnpublish = (pub: TrackPublication) => {
		pub.track?.detach();
		if (!pubElements.has(pub.trackSid)) return;
		const e = pubElements.get(pub.trackSid);
		e?.remove();
	}

	const onMute = (pub: TrackPublication) => {
		if (!pubElements.has(pub.trackSid)) return;
		const e = pubElements.get(pub.trackSid)!;
		e.style.display = "none";
	}
	const onUnmute = (pub: TrackPublication) => {
		if (!pubElements.has(pub.trackSid)) return;
		const e = pubElements.get(pub.trackSid)!;
		e.style.display = "block";
	}

	createEffect(() => {
		// consume existing publications
		for (const [_k, v] of p.trackPublications) {
			if (!v) continue;
			onPublish(v);
		}
	});

	p.on(ParticipantEvent.TrackPublished, onPublish)
		.on(ParticipantEvent.LocalTrackPublished, onPublish)
		.on(ParticipantEvent.TrackSubscribed, onSubscribe)
		.on(ParticipantEvent.TrackUnsubscribed, onUnsubscribe)
		.on(ParticipantEvent.LocalTrackUnpublished, onLocalUnpublish)
		.on(ParticipantEvent.TrackMuted, onMute)
		.on(ParticipantEvent.TrackUnmuted, onUnmute)

	return (
		<div class="relative aspect-video bg-surface-secondary rounded-lg overflow-hidden border border-border">
			{/* Media Container */}
			<div ref={mediaCon} class="w-full h-full">
				{/* Media Tracks are automatically inserted here */}
			</div>
			
			{/* Fallback Avatar when no video */}
			<Show when={!p.videoTrackPublications.size}>
				<div class="absolute inset-0 flex items-center justify-center bg-surface-secondary">
					<Avatar 
						userId={pUser?.id || ''} 
						avatar={pUser?.avatar} 
						size="lg" 
						class="w-20 h-20" 

					/>
				</div>
			</Show>
			
			{/* User Info Overlay */}
			<div class="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded flex items-center gap-2">
				{/* Speaking Indicator */}
				<Show when={soundDetected()}>
					<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
				</Show>
				<span>{pUser?.username}#{pUser?.discriminator}</span>
			</div>
			
			{/* Speaking Border */}
			<div
				class="absolute inset-0 border-2 border-green-500 rounded-lg transition-opacity duration-200 pointer-events-none"
				style={{
					opacity: soundDetected() ? 1 : 0,
				}}
			></div>
		</div>
	)
}