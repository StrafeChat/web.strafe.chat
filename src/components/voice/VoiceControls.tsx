import { Component, Show } from "solid-js";
import { useVoice } from "../../lib/providers/voice/VoiceProvider";
import { Tooltip } from "../common/Tooltip";

export const VoiceControls: Component = () => {
	const { enableCamera, enableMicrophone, enabledMedia, currentDevices } = useVoice();

	const handleToggleMicrophone = async () => {
		await enableMicrophone(!enabledMedia().audio, { deviceId: currentDevices.audio()?.deviceId || undefined });
	};

	const handleToggleCamera = async () => {
		await enableCamera(!enabledMedia().video);
	};

	return (
		<div class="flex items-center justify-center gap-3">
			{/* Microphone Control */}
			<Tooltip content={enabledMedia().audio ? "Mute microphone" : "Unmute microphone"} position="top">
				<button
					onClick={handleToggleMicrophone}
					class={`p-3 rounded-full transition-all duration-200 ${
						enabledMedia().audio
							? "bg-surface hover:bg-surface-hover text-text-primary"
							: "bg-red-500 hover:bg-red-600 text-white"
					}`}
				>
					<Show when={enabledMedia().audio} fallback={
						<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="1" y1="1" x2="23" y2="23"></line>
							<path d="M9 9v3a3 3 0 0 0 5.12 2.12l1.27-1.27A3 3 0 0 0 15 11V5a3 3 0 0 0-3-3 3 3 0 0 0-3 3v.17L9 5.17"></path>
							<path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
							<line x1="12" y1="19" x2="12" y2="23"></line>
							<line x1="8" y1="23" x2="16" y2="23"></line>
						</svg>
					}>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
							<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
							<line x1="12" y1="19" x2="12" y2="23"></line>
							<line x1="8" y1="23" x2="16" y2="23"></line>
						</svg>
					</Show>
				</button>
			</Tooltip>

			{/* Camera Control */}
			<Tooltip content={enabledMedia().video ? "Turn off camera" : "Turn on camera"} position="top">
				<button
					onClick={handleToggleCamera}
					class={`p-3 rounded-full transition-all duration-200 ${
						enabledMedia().video
							? "bg-surface hover:bg-surface-hover text-text-primary"
							: "bg-surface hover:bg-surface-hover text-text-secondary"
					}`}
				>
					<Show when={enabledMedia().video} fallback={
						<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
							<line x1="1" y1="1" x2="23" y2="23"></line>
						</svg>
					}>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polygon points="23,7 16,12 23,17 23,7"></polygon>
							<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
						</svg>
					</Show>
				</button>
			</Tooltip>
		</div>
	);
}