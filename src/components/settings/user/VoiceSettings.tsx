import { Component } from "solid-js";
import { PhoneRinging } from "../../shared/icons/PhoneRinging";
import { InputSelector } from "../../shared/InputSelector";
import { useVoice } from "../../../lib/providers/voice/VoiceProvider";

export const VoiceSettings: Component = () => {
	const { setDevice } = useVoice();

	return (
		<div style="margin-bottom: 2rem;">
			{/* Header with Icon */}
			<div class="flex items-center gap-3 mb-6">
				<div class="p-3 bg-primary/10 rounded-lg">
					<PhoneRinging />
				</div>
				<div>
					<h2 class="text-xl font-semibold text-text-primary mb-1">
						Voice and Video Chats
					</h2>
					<p class="text-text-secondary text-xs">
						Customise your audiophile experience
					</p>
				</div>
			</div>

			<div class="bg-background1 rounded-lg p-6 mb-6">
				<div class="flex items-center gap-4 mb-4">
					<div class="p-2 bg-primary/10 rounded-lg">
						<PhoneRinging></PhoneRinging>
					</div>
					<h3 class="text-lg font-semibold text-text-primary">Audio</h3>
				</div>
				<h4>Input Devices</h4>
				<InputSelector onChange={(d: MediaDeviceInfo) => { setDevice(d); console.log(d, d.label); }} types={{ audioOut: false, videoIn: false }} />
			</div>
		</div>
	)
}