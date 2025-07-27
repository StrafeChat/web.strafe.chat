import { Component } from "solid-js";

const LoadingSpinner: Component<{ class?: string }> = (props) => {
  return (
    <div
      class={`animate-spin rounded-full border-2 border-current border-t-transparent ${props.class || "w-4 h-4"}`}
      {...props}
    >
    </div>
  );
};

export default LoadingSpinner;