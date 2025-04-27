import { Component, createEffect } from "solid-js";
import { createStore } from "solid-js/store";

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  class?: string;
}

export const AnimatedCheckbox: Component<AnimatedCheckboxProps> = (props) => {
  const [state, setState] = createStore({
    checked: props.checked,
    animating: false,
  });

  createEffect(() => {
    if (props.checked !== state.checked) {
      setState({ checked: props.checked, animating: true });
      

      setTimeout(() => {
        setState({ animating: false });
      }, 850);
    }
  });

  const handleClick = () => {
    const newChecked = !state.checked;
    setState({ checked: newChecked, animating: true });
    
    setTimeout(() => {
      setState({ animating: false });
    }, 850);
    
    props.onChange?.(newChecked);
  };

  return (
    <div
      class={`relative w-6 h-6 cursor-pointer ${props.class || ""}`}
      onClick={handleClick}
    >
      {/* Circle background */}
      <div
        class={`w-full h-full rounded-full transition-all duration-300 ${state.checked ? "bg-green-500 scale-[1.05]" : "bg-background border-2 border-border hover:border-green-500/50 hover:scale-[1.02]"}`}
      ></div>
      
      {/* Checkmark */}
      <svg
        class={`absolute inset-0 w-full h-full p-1 transition-opacity duration-300 ${state.checked ? "opacity-100" : "opacity-0"}`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 13L9 17L19 7"
          stroke="white"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="24"
          stroke-dashoffset={state.animating && state.checked ? "0" : "24"}
          class={state.animating && state.checked ? "animate-draw-checkmark" : ""}
        />
      </svg>
    </div>
  );
};

export default AnimatedCheckbox;