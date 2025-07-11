import { Component, createSignal, createEffect, Show, Switch, Match } from "solid-js";
import { RoomWithRecipients } from "../../types/rooms";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { Room } from 'livekit-client';
import { LIVEKIT_URL } from "../../constants";

type PMCallProps = {
	room: RoomWithRecipients
}

export const PMCall: Component<PMCallProps> = (props: PMCallProps) => {
	// automatically tries to join on render

	const r = props.room;

	const [connected, setConnected] = createSignal(0);

	createEffect(() => {
		const { getJoinToken } = useAuth();
		setConnected(1);
		getJoinToken(r.id).then(token => startCall(token));
	});

	const startCall = async function(token: string): Promise<void> {
		try {
			const room = new Room();
			await room.connect(LIVEKIT_URL, token);

			console.log('connected to room', room.name);

			setConnected(2);
		} catch(e) {
			console.error(e);
			setConnected(0);
		}
	}

	return (
		<div>
			<h1>{props.room.id}</h1>

			<Switch>
				<Match when={connected() === 1}>
					<p>Connecting...</p>
				</Match>
				<Match when={connected() === 2}>
					<p>Connection established</p>
				</Match>
				<Match when={connected() === 0}>
					<p>Error.</p>
				</Match>
			</Switch>
		</div>
	)
}