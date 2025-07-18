import { Rerun } from "@solid-primitives/keyed";
import { Component, createMemo } from "solid-js";
import { AudioPlayer } from "../../../ui/AudioPlayer";

export const StableAudioPlayer: Component<{
  src: string;
  name: string;
  size: number;
  messageId?: string;
}> = (props) => {
  // Create a stable key based on the audio file properties
  const stableKey = createMemo(
    () =>
      `${props.messageId || "unknown"}-${props.src}-${props.name}-${props.size}`,
  );

  return (
    <Rerun on={stableKey}>
      <AudioPlayer src={props.src} name={props.name} size={props.size} />
    </Rerun>
  );
};
