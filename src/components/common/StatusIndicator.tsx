import { Component } from "solid-js";

export type UserStatus = "online" | "idle" | "dnd" | "offline";

interface StatusIndicatorProps {
  status: UserStatus;
  class?: string;
}

export const StatusIndicator: Component<StatusIndicatorProps> = (props) => {
  const getStatusColor = () => {
    switch (props.status) {
      case "online":
        return "bg-[#43B581]";
      case "idle":
        return "bg-[#FAA81A]";
      case "dnd":
        return "bg-[#F04747]";
      case "offline":
        return "bg-[#747F8D]";
    }
  };

  return (
    <div
      class={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[3px] ${getStatusColor()} ${
        props.class || ""
      }`}
    />
  );
};
