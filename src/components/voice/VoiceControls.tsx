import { Component } from "solid-js";
import { useVoice } from "../../lib/providers/voice/VoiceProvider";

export const VoiceControls: Component = () => {
	const { enableCamera, enableMicrophone, enabledMedia } = useVoice();

	return (
		<div
			style="display: flex; flex-direction: row; gap: 0.5rem;"
		>
			<button class="p-2 text-text-secondary hover:bg-surface hover:bg-opacity-20 transition-colors flex-shrink-0" onClick={() => {
				enableCamera(!enabledMedia().video);
			}}
				style={{
					"text-decoration": (enabledMedia().video) ? "none" : "strikethrough",
				}}>
				Camera
			</button>
			<button class="p-2 text-text-secondary hover:bg-surface hover:bg-opacity-20 transition-colors flex-shrink-0" onClick={() => {
				enableMicrophone(!enabledMedia().audio);
			}}
			style={{
				"text-decoration": (enabledMedia().audio) ? "none" : "strikethrough",
			}}>
				Microphone
			</button>
		</div>
	)
}