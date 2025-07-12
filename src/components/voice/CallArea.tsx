import { Component, createEffect, createSignal, For, JSXElement } from "solid-js";
import { useVoice, VoiceState } from "../../lib/providers/voice/VoiceProvider";
import { ParticipantElement } from "./ParticipantElement";
import { Participant, RemoteParticipant, RoomEvent } from "livekit-client";

export const CallArea: Component = () => {
	const { livekitRoom, state } = useVoice();
	const [ps, setPs] = createSignal<Participant[]>([]);

	var container!: HTMLDivElement;
	const [local, setLocal] = createSignal<JSXElement | null>(null);

	const onJoin = (p: RemoteParticipant) => {
		setPs([...ps(), p]);
	}

	createEffect(() => {
		
		if (state() !== VoiceState.CONNECTED) {
			return;
		}
		// room has to exist if the voice state is connected
		const room = livekitRoom()!;



		setLocal(<ParticipantElement isLocal={true} p={room.localParticipant}></ParticipantElement>);
		room.on(RoomEvent.ParticipantConnected, onJoin);

		console.log(room.remoteParticipants);

		const tps: RemoteParticipant[] = [];
		for (let [_k, v] of room.remoteParticipants) {
			tps.push(v);
		}

		setPs(tps);

		//enableCamera(true);
	});

	return (
		<div ref={container} style="padding: 0.1rem;">
			<h1>Call Area</h1>
			<div style="
				display: flex;
				flex-direction: row;
				gap: 0.2rem;"
			>
				<div>
					{local()}
				</div>
				<For each={ps()}>
					{(item, _index) => (
						<ParticipantElement isLocal={true} p={item}></ParticipantElement>
					)}
				</For>
			</div>
		</div>
	)
}