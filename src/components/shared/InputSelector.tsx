import { Room } from "livekit-client";
import { Component, createEffect, createSignal } from "solid-js";
import { Dropdown, DropdownOption } from "./Dropdown";
//import { useVoice } from "../../lib/providers/voice/VoiceProvider";

type InputSelectorProps = {
  onChange: (device: MediaDeviceInfo) => void;
  types?: {
    audioIn?: boolean;
    audioOut?: boolean;
    videoIn?: boolean;
  };
};

export const InputSelector: Component<InputSelectorProps> = (
  props: InputSelectorProps,
) => {
  const [options, setOptions] = createSignal<DropdownOption<MediaDeviceInfo>[]>(
    [],
  );
  const [currentDevice, setCurrentDevice] = createSignal<MediaDeviceInfo>();
  //const { currentDevices } = useVoice();

  const types = {
    audioIn: true, // default values
    audioOut: true,
    videoIn: true,

    ...props.types,
  };
  const allowedKinds: string[] = [];
  if (types.audioIn) allowedKinds.push("audioinput");
  if (types.audioOut) allowedKinds.push("audiooutput");
  if (types.videoIn) allowedKinds.push("videoinput");

  createEffect(async () => {
    const devices = (await Room.getLocalDevices()).filter((e) => {
      return allowedKinds.includes(e.kind);
    });

    //const curr = currentDevices.audio() || currentDevices.video();

    setCurrentDevice(devices[0]);
    const os = devices.map((d): DropdownOption<MediaDeviceInfo> => {
      return {
        value: d,
        label: d.label,
        icon: undefined,
      };
    });
    setOptions(os);
  });

  const selectDevice = (i: MediaDeviceInfo) => {
    console.log(i);
    props.onChange(i);
    setCurrentDevice(i);
    //localStorage.setItem("sc_input_device", i.deviceId);
    //localStorage.setItem("sc_output_device", i.deviceId);
    //localStorage.setItem("sc_video_device", i.deviceId);
  };

  return (
    <div>
      <Dropdown
        class={"w-[265px] sm:w-[285px]"}
        options={options()}
        onChange={selectDevice}
        value={currentDevice()!}
      ></Dropdown>
    </div>
  );
};
