import { useEffect, useState, DetailedHTMLProps, HTMLAttributes } from "react";
import { useVoice } from "@/hooks";

function findMinMax(arr: Uint8Array) {
  let min = arr[0];
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
    if (arr[i] > max) max = arr[i];
  }
  return [min, max];

}

export function WaveformVisualisation(props: {
  track: MediaStreamTrack,
  color?: string,
  barNumber?: number,
  height?: {
    min: number,
    max: number, // max height - min height
  },
  minTreshold?: number, // TODO: implement
  style: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>,
}) {
  const { connection } = useVoice();

  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();

  const [barHeights, setBarHeights] = useState<number[]>(new Array(props.barNumber || 4).fill(0));

  const height = props.height?.max || 30; // in pixels
  const minHeight = props.height?.min || 2; // in pixels
  const waves = props.barNumber || 4; // amount of bars used, needs to be a divisor of buffer length

  const nullPoint = 255 / 2;

  useEffect(() => {
    if (!connection) return () => {};
    if (!props.track) return; //console.warn("No track provided");
    if (props.track.kind !== "audio") return console.warn("Track is not an audio track");
    const stream = new MediaStream([props.track]);
    if (!stream) return;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 32;
    const bufferLength = analyser.frequencyBinCount;

    // update the visualisation live for the last 3 seconds
    const dataArray = new Uint8Array(bufferLength);
    
    var cycle = 0;
    var stop = false;
    const draw = () => {
      if (!stop) requestAnimationFrame(draw);
      if (cycle++ % 10 !== 0) return;
      analyser.getByteTimeDomainData(dataArray);
      const reduced = dataArray.map(v => { // currently no sounde === about 128, this reduces it to 0
        const val = v - nullPoint;
        return val < 0 ? -1 * val : val;
      });
      const [min, max] = findMinMax(reduced);
      const maxVal = (max - min);
      const wave = reduced.map((v) => {
        if (maxVal === 0 || (v - min) === 0) return minHeight;
        return (v - min) / maxVal * height;
      });


      const bars: (number)[] = [];
      const temp: (number)[] = [];
      wave.forEach((v, i) => {
        temp.push(v);
        if (temp.length % (bufferLength / waves) === 0) {
          bars.push(temp.reduce((a, b) => a + b) / temp.length);
          temp.length = 0;
        }
      });

      setBarHeights(bars);
    }
    draw();


    return () => {
      source.disconnect(analyser);
      audioCtx.close();
      stop = true;
    }
  }, [props.track, connection]);

  return (
    <div style={props.style}>
      <div style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        height: (height + 2) + "px",
      }}>
        {barHeights.map((height, i) => (
          <div key={i} style={{
            backgroundColor: props.color || "white",
            height: (height) + "px",
            width: "10px",
            display: "inline-block",
            margin: "1px",
            borderRadius: "25%",
            transition: "height 0.1s ease-in-out",
          }}></div>
        ))}
      </div>
    </div>
  );
}