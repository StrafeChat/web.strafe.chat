import { createContext, ParentComponent, useContext } from "solid-js";

import { NoiseSuppressorWorklet_Name } from "@timephy/rnnoise-wasm"
import NoiseSuppressorWorklet from "@timephy/rnnoise-wasm/NoiseSuppressorWorklet?worker&url"

export type RNNoiseContextType = {
	rnnoise: (stream: MediaStream) => Promise<MediaStream>;
}

const RNNoiseContext = createContext<RNNoiseContextType>();

export const RNNoiseProvider: ParentComponent = (props) => {
	const rnnoise = async (s: MediaStream) => {
		const ctx = new AudioContext();
		await ctx.audioWorklet.addModule(NoiseSuppressorWorklet);

		const noiseSuppressionNode = new AudioWorkletNode(ctx, NoiseSuppressorWorklet_Name);
		const source = ctx.createMediaStreamSource(s);
		source.connect(noiseSuppressionNode)
		
		const dest = ctx.createMediaStreamDestination();
		noiseSuppressionNode.connect(dest);

		return dest.stream;
	}

	return (
		<RNNoiseContext.Provider
			value={{
				rnnoise
			}}
		>
			{props.children}
		</RNNoiseContext.Provider>
	)
}

export const useRNNoise = () => {
	const context = useContext(RNNoiseContext);
	if (!context) {
		throw new Error("useRNNoise must be used within a RNNoiseProvider");
	}
	return context;
}