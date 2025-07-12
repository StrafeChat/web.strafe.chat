import { Component, createEffect, Switch, Match } from "solid-js";
import { RoomWithRecipients } from "../../types/rooms";
import { useVoice, VoiceState } from "../../lib/providers/voice/VoiceProvider";
import { VoiceControls } from "./VoiceControls";
import { CallArea } from "./CallArea";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";

type PMCallProps = {
	room: RoomWithRecipients
}

export const PMCall: Component<PMCallProps> = (props: PMCallProps) => {
	// automatically tries to join on render

	const r = props.room;

	const { state } = useVoice();
	const { getUser } = useCache();
	const { user } = useAuth();

	createEffect(() => {
		const { connect } = useVoice();
		connect(r.id);
		
	});

	return (
		<div style="padding: 0.5rem;">
			<h1>{getUser(r.recipients[(r.recipients[0] != user()!.id) ? 0 : 1])?.username}</h1>

			<Switch>
				<Match when={state() === VoiceState.CONNECTING}>
					<p>Connecting...</p>
				</Match>
				<Match when={state() === VoiceState.CONNECTED}>
					<p>Connection established</p>
				</Match>
				<Match when={state() === VoiceState.ERROR}>
					<p>Error.</p>
				</Match>
			</Switch>

			<CallArea></CallArea>

			<VoiceControls></VoiceControls>
		</div>
	)
}