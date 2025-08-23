import { VoicePayloadType } from "../../ws/WebSocketClient";

export type VoiceUpdateData = {
	event_type: VoicePayloadType,
	participant_id: string,
	room_id: string,
}

export const handleVoiceUpdate = (type: VoicePayloadType, data: VoiceUpdateData) => {
	
}