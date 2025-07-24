import { Component, createEffect, createMemo } from "solid-js"
import { CallArea } from "../../voice/CallArea"
import { useVoice, VoiceState } from "../../../lib/providers/voice/VoiceProvider"

export type VoiceRoomProps = {
	room: string,
}

export const VoiceRoom: Component<VoiceRoomProps> = (props: VoiceRoomProps) => {

	const { connect, state } = useVoice();
	const roomId = createMemo(() => {
		return props.room;
	})
	
	const connectRoom = async () => {
		await connect(roomId());

		
	}

	return (
		<div>
			<CallArea />

			<button onClick={connectRoom}>Connect</button>
		</div>
	)
}