import { Component, createEffect, Switch, Match, Show } from "solid-js";
import { RoomWithRecipients } from "../../types/rooms";
import { useVoice, VoiceState } from "../../lib/providers/voice/VoiceProvider";
import { VoiceControls } from "./VoiceControls";
import { CallArea } from "./CallArea";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { Avatar } from "../common/Avatar";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";

type PMCallProps = {
	room: RoomWithRecipients
}

export const PMCall: Component<PMCallProps> = (props: PMCallProps) => {
	const r = props.room;

	const { state, disconnect, connect } = useVoice();
	const { getUser } = useCache();
	const { user } = useAuth();

	// Get the other user in the call
	const getCallPartner = () => {
		const currentUserId = user()?.id;
		const otherUserId = r.recipients?.find(id => id !== currentUserId);
		return otherUserId ? getUser(otherUserId) : null;
	};

	// Don't auto-connect - connection is handled by the call button in RoomView

	const handleEndCall = async () => {
		await disconnect();
	};

	return (
		<div class="border-b border-[var(--surface)] p-2">
			<CallArea />
		</div>
	);
};