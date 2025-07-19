import { createSignal } from "solid-js";

type ToggleState = "on" | "n/a" | "off";

interface ThreeToggleProps {
  id: string;
  defaultValue: ToggleState;
  onChange?: (value: ToggleState) => void;
  class?: string;
}

const nextValue: Record<ToggleState, ToggleState> = {
  on: "off",
  off: "n/a",
  "n/a": "on",
};

const iconMap: Record<ToggleState, string> = {
  on: "✔️",
  off: "❌",
  "n/a": "➖",
};

const bgMap: Record<ToggleState, string> = {
  on: "bg-green-500 text-white border-green-500",
  off: "bg-red-500 text-white border-red-500",
  "n/a": "bg-transparent text-gray-500 border-gray-300",
};

export default function ThreeToggle(props: ThreeToggleProps) {
  const [value, setValue] = createSignal<ToggleState>(props.defaultValue);

  const handleClick = () => {
    const newValue = nextValue[value()];
    setValue(newValue);
    props.onChange?.(newValue);
  };

  return (
    <button
      id={props.id}
      type="button"
      onClick={handleClick}
      class={`w-10 h-10 border-2 rounded-md flex items-center justify-center text-lg font-semibold transition-all duration-200 ${bgMap[value()]} ${props.class ?? ""}`}
    >
      {iconMap[value()]}
    </button>
  );
}