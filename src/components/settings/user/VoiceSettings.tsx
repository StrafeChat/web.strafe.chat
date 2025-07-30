import { Component, createSignal, For } from "solid-js";
import { PhoneRinging } from "../../shared/icons/PhoneRinging";
import { InputSelector } from "../../shared/InputSelector";
import { useVoice } from "../../../lib/providers/voice/VoiceProvider";

export const VoiceSettings: Component = () => {
  const { setDevice } = useVoice();

  const [inputVolume, setInputVolume] = createSignal(50);
  const [outputVolume, setOutputVolume] = createSignal(50);

  // Mic test state
  const [micTestActive, setMicTestActive] = createSignal(false);
  const [micLevels, setMicLevels] = createSignal<number[]>(Array(35).fill(0));
  let audioTrack: any = null;
  let audioCtx: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let playback: HTMLAudioElement | null = null;

  // Helper for Discord-like slider background
  const getSliderBg = (value: number) =>
    `background: linear-gradient(to right, #43b581 0%, #43b581 ${value}%, #4f545c ${value}%, #4f545c 100%);`;

  // Start mic test
  async function startMicTest() {
    setMicTestActive(true);

    // Use constraints for better quality
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 48000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
    audioTrack = stream.getAudioTracks()[0];

    // Create audio context for level meter and volume control
    audioCtx = new window.AudioContext({ sampleRate: 48000 });
    const source = audioCtx.createMediaStreamSource(stream);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = inputVolume() / 100; // Set initial input volume

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;

    source.connect(gainNode);
    gainNode.connect(analyser);
    gainNode.connect(audioCtx.destination);

    // Play back to user using HTMLAudioElement
    playback = document.createElement("audio");
    playback.srcObject = stream;
    playback.autoplay = true;
    playback.controls = false;
    playback.style.display = "none";
    document.body.appendChild(playback);

    // Animate levels
    function updateLevels() {
      if (!micTestActive()) {
        audioTrack.stop();
        audioCtx!.close();
        playback!.pause();
        playback!.srcObject = null;
        playback!.remove();
        return;
      }
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const bars = Array.from({ length: 35 }, (_, i) => {
        const idx = Math.floor((i * data.length) / 35);
        return Math.min(1, data[idx] / 128);
      });
      setMicLevels(bars);
      requestAnimationFrame(updateLevels);
    }
    updateLevels();
  }

  function stopMicTest() {
    setMicTestActive(false);
    if (audioTrack) audioTrack.stop();
    if (audioCtx) audioCtx.close();
    if (playback) {
      playback.pause();
      playback.srcObject = null;
      playback.remove();
    }
  }

  // Update input volume live
  function handleInputVolume(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    setInputVolume(value);
    if (gainNode) gainNode.gain.value = value / 100;
  }

  // Output volume control for playback element
  function handleOutputVolume(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    setOutputVolume(value);
    if (playback) playback.volume = value / 100;
  }

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
        <div class="flex flex-col sm:flex-row gap-1 w-full">
          <div class="flex-1 min-w-0 w-full sm:w-auto">
            <h4 class="mb-1">Input Devices</h4>
            <InputSelector
              onChange={(d: MediaDeviceInfo) => {
                setDevice(d);
                console.log(d, d.label);
              }}
              types={{ audioOut: false, videoIn: false }}
            />
            {/* Input Volume Slider */}
            <div class="mt-2 flex flex-col">
              <label
                class="text-xs text-text-secondary mb-1"
                for="input-volume"
              >
                Input Volume
              </label>
              <input
								disabled
                id="input-volume"
                type="range"
                min="0"
                max="100"
                value={inputVolume()}
                style={getSliderBg(inputVolume())}
                class="appearance-none w-[265px] sm:w-[285px] h-2 rounded-lg outline-none transition-all
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:shadow
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-[#23272a]
                  [&::-webkit-slider-thumb]:transition-all
                  [&::-moz-range-thumb]:appearance-none
                  [&::-moz-range-thumb]:w-4
                  [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:bg-white
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:shadow
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-[#23272a]
                  [&::-moz-range-thumb]:transition-all
                  [&::-ms-thumb]:appearance-none
                  [&::-ms-thumb]:w-4
                  [&::-ms-thumb]:h-4
                  [&::-ms-thumb]:bg-white
                  [&::-ms-thumb]:rounded-full
                  [&::-ms-thumb]:shadow
                  [&::-ms-thumb]:border-2
                  [&::-ms-thumb]:border-[#23272a]
                  [&::-ms-thumb]:transition-all"
                onInput={handleInputVolume}
              />
            </div>
          </div>
          <div class="flex-1 min-w-0 w-full sm:w-auto">
            <h4 class="mb-1">Output Devices</h4>
            <InputSelector
              onChange={(d: MediaDeviceInfo) => {
                setDevice(d);
                console.log(d, d.label);
              }}
              types={{ videoIn: false, audioIn: false }}
            />
            {/* Output Volume Slider */}
            <div class="mt-2 flex flex-col">
              <label
                class="text-xs text-text-secondary mb-1"
                for="output-volume"
              >
                Output Volume
              </label>
              <input
								disabled
								id="output-volume"
                type="range"
                min="0"
                max="100"
                value={outputVolume()}
                style={getSliderBg(outputVolume())}
                class="appearance-none w-[265px] sm:w-[285px] h-2 rounded-lg outline-none transition-all
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:shadow
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-[#23272a]
                  [&::-webkit-slider-thumb]:transition-all
                  [&::-moz-range-thumb]:appearance-none
                  [&::-moz-range-thumb]:w-4
                  [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:bg-white
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:shadow
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-[#23272a]
                  [&::-moz-range-thumb]:transition-all
                  [&::-ms-thumb]:appearance-none
                  [&::-ms-thumb]:w-4
                  [&::-ms-thumb]:h-4
                  [&::-ms-thumb]:bg-white
                  [&::-ms-thumb]:rounded-full
                  [&::-ms-thumb]:shadow
                  [&::-ms-thumb]:border-2
                  [&::-ms-thumb]:border-[#23272a]
                  [&::-ms-thumb]:transition-all"
                onInput={handleOutputVolume}
              />
            </div>
          </div>
        </div>

        {/* Mic Test Section - moved directly below sliders */}
        <div class="mt-6">
          <h4 class="text-sm font-semibold mb-1">Mic Test</h4>
          <p class="text-xs text-text-secondary mb-2">
            Is your mic working? Let's check. Start a test and say something, it
            will play back.
          </p>
          <div class="flex items-center">
            <button
              class="px-3 py-1 rounded bg-[#43b581] text-white font-semibold text-xs mr-3 transition hover:bg-primary/80"
              onClick={() => (micTestActive() ? stopMicTest() : startMicTest())}
            >
              {micTestActive() ? "Stop Testing" : "Let's Check"}
            </button>
            <div class="inline-flex items-center" style="align-items: center;">
              {/* Mic Level Bars */}
              <For each={micLevels()}>
                {(level) => (
                  <div
                    style={{
                      height: "18px",
                      width: "5px",
                      "margin-right": "2px",
                      "border-radius": "2px",
                      background:
                        micTestActive() && level > 0.1
                          ? `linear-gradient(to top, #43b581, #aeea7c)`
                          : "#4f545c",
                      opacity: micTestActive() && level > 0.1 ? 1 : 0.7,
                      transition: "background 0.2s",
                    }}
                  />
                )}
              </For>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-background1 rounded-lg p-6 mb-6">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-2 bg-primary/10 rounded-lg">
            <PhoneRinging></PhoneRinging>
          </div>
          <h3 class="text-lg font-semibold text-text-primary">Video</h3>
        </div>
        <h4>Input Devices</h4>
        <InputSelector
          onChange={(d: MediaDeviceInfo) => {
            setDevice(d);
            console.log(d, d.label);
          }}
          types={{ audioOut: false, audioIn: false }}
        />
      </div>
    </div>
  );
};
