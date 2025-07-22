import { Component, createEffect, createSignal, For, JSXElement } from "solid-js";
import { useVoice, VoiceState } from "../../lib/providers/voice/VoiceProvider";
import { ParticipantElement } from "./ParticipantElement";
import { Participant, RemoteParticipant, RoomEvent } from "livekit-client";

export const CallArea: Component = () => {
	const { livekitRoom, state } = useVoice();
	const [ps, setPs] = createSignal<Participant[]>([]);
	const [focusedParticipant, setFocusedParticipant] = createSignal<Participant | null>(null);

	var container!: HTMLDivElement;
	const [local, setLocal] = createSignal<JSXElement | null>(null);

	const onJoin = (p: RemoteParticipant) => {
		setPs([...ps(), p]);
	}

	const onLeave = (p: RemoteParticipant) => {
		setPs(ps().filter(participant => participant.sid !== p.sid));
		// Clear focus if the focused participant left
		if (focusedParticipant()?.sid === p.sid) {
			setFocusedParticipant(null);
		}
	}

	createEffect(() => {
		if (state() !== VoiceState.CONNECTED) {
			setFocusedParticipant(null);
			return;
		}
		// room has to exist if the voice state is connected
		const room = livekitRoom()!;

		setLocal(<ParticipantElement isLocal={true} p={room.localParticipant} onFocus={() => setFocusedParticipant(room.localParticipant)}></ParticipantElement>);
		room.on(RoomEvent.ParticipantConnected, onJoin);
		room.on(RoomEvent.ParticipantDisconnected, onLeave);

		console.log(room.remoteParticipants);

		const tps: RemoteParticipant[] = [];
		for (let [_k, v] of room.remoteParticipants) {
			tps.push(v);
		}

		setPs(tps);
	});

	return (
		<div ref={container} class="space-y-3">
			{/* Focused Participant - Large view */}
			{focusedParticipant() && (
				<div class="relative aspect-video bg-surface-secondary rounded-lg overflow-hidden border-2 border-blue-500">
					<ParticipantElement 
						isLocal={focusedParticipant()!.sid === livekitRoom()?.localParticipant.sid} 
						p={focusedParticipant()!} 
						onFocus={() => {}} 
					/>
					<div class="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
						<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
							<path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
						</svg>
						Focused
					</div>
					<button 
						class="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded transition-colors"
						onClick={() => setFocusedParticipant(null)}
					>
						×
					</button>
				</div>
			)}
			
			{/* Participants Grid */}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{/* Local Participant */}
				<div class="relative cursor-pointer hover:ring-2 hover:ring-blue-400 rounded-lg transition-all" onClick={() => setFocusedParticipant(livekitRoom()?.localParticipant || null)}>
					{local()}
					<div class="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
						You
					</div>
				</div>
				
				{/* Remote Participants */}
				<For each={ps()}>
					{(item, _index) => (
						<div class="relative cursor-pointer hover:ring-2 hover:ring-blue-400 rounded-lg transition-all" onClick={() => setFocusedParticipant(item)}>
							<ParticipantElement isLocal={false} p={item} onFocus={() => setFocusedParticipant(item)}></ParticipantElement>
						</div>
					)}
				</For>
			</div>
		</div>
	)
}