import { Component } from "solid-js";

const GroupUsers: Component<{ class?: string }> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={props.class || "w-5 h-5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M15 3a4 4 0 0 1 0 8" />
      <path d="M23 13a4 4 0 0 1-3 3.87" />
      <path d="M1 13a4 4 0 0 0 3 3.87" />
      <path d="M9 3a4 4 0 0 0 0 8" />
    </svg>
  );
};

export default GroupUsers;