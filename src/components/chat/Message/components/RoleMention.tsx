import { Component } from "solid-js";

interface RoleMentionProps {
  roleId: string;
  className?: string;
}

export const RoleMention: Component<RoleMentionProps> = (props) => {
  // TODO: Implement role lookup from space/room context when role system is available
  const displayName = `Role ${props.roleId}`;
  
  return (
    <span 
      class={`mention mention-role bg-purple-500 bg-opacity-20 text-purple-500 px-1 rounded cursor-pointer hover:bg-opacity-30 transition-colors ${props.className || ''}`}
      title={`@${displayName}`}
    >
      @{displayName}
    </span>
  );
};