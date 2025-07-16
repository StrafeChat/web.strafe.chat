import { Component } from "solid-js";
// import { useTransContext } from "@mbarzda/solid-i18next";

interface UnreadDividerProps {
  ref?: (element: HTMLDivElement) => void;
}

const UnreadDivider: Component<UnreadDividerProps> = (props) => {
  // const [t] = useTransContext();

  return (
    <div ref={props.ref} class="flex items-center justify-center px-4">
      <div class="flex-grow h-[1px] bg-red-500"></div>
      <div class="mx-4 text-sm text-red-500 font-bold">NEW</div>
      <div class="flex-grow h-[1px] bg-red-500"></div>
    </div>
  );
};

export default UnreadDivider;
