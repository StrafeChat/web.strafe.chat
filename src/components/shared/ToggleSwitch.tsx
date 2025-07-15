import { Component } from "solid-js";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
  label?: string;
}

const ToggleSwitch: Component<ToggleSwitchProps> = (props) => {
  const handleToggle = () => {
    if (!props.disabled) {
      props.onChange(!props.checked);
    }
  };

  return (
    <div class={`flex items-center gap-3 ${props.class || ""}`}>
      <button
        onClick={handleToggle}
        disabled={props.disabled}
        class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          props.checked ? "bg-primary" : "bg-gray-400"
        }`}
        role="switch"
        aria-checked={props.checked}
      >
        <span
          class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
            props.checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {props.label && (
        <label class="text-sm text-text-primary cursor-pointer" onClick={handleToggle}>
          {props.label}
        </label>
      )}
    </div>
  );
};

export default ToggleSwitch;