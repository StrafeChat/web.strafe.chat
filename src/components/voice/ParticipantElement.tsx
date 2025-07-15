import { Participant, ParticipantEvent, RemoteTrack, RemoteTrackPublication, Track, TrackPublication } from "livekit-client";
import { Component, createEffect, createSignal } from "solid-js";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useCache } from "../../lib/providers/cache/CacheProvider";

type ParticipantProps = {
	p: Participant,
	isLocal: boolean
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
				element.muted = true;
				//setupSpeakingIndicator(track as Track<Track.Kind.Audio>);
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
		<div>
			<div 
				style="
				aspect-ratio: 1/1;
  		  height: 20rem;
   			background-color: #559353;
   			display: flex;
				flex-direction: row;
				align-items: center;
    		border-radius: 5px;
				position: relative"
			>
				<div ref={mediaCon}>
					{/* Media Tracks are automatically inserted here */}
				</div>
				<div
					style="
					position: absolute;
					z-index: 10;
					bottom: 0;
					padding: 0.1rem;
					padding-left: 0.2rem;
					background-color: rgba(0, 0, 0, 0.6);
					border-radius: 5px;
					margin: 0.1rem;"
				>
					<h1>{pUser?.username}#{pUser?.discriminator}</h1>
				</div>
				<div
					style={{
						position: "absolute",
						width: "100%",
						height: "100%",
						"z-index": 20,
						border: "2px solid red",
						"border-radius": "5px",
						top: 0,
						left: 0,
						transition: "0.2s opacity",
						opacity: (soundDetected()) ? 1 : 0,
					}}
				>

				</div>
			</div>
		</div>
	)
}