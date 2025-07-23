import { Component, createMemo } from "solid-js";
import { useCache } from "../../../../lib/providers/cache/CacheProvider";

interface UserMentionProps {
  userId: string;
  className?: string;
}

export const UserMention: Component<UserMentionProps> = (props) => {
  const cache = useCache();
  
  const user = createMemo(() => {
    const allUsers = cache.users();
    return allUsers ? allUsers[props.userId] : null;
  });
  
  const displayName = createMemo(() => {
    const userData = user();
    return userData ? (userData.display_name || userData.username) : `Unknown User`;
  });
  
  const handleClick = (e: MouseEvent) => {
    // Prevent the event from bubbling up to parent elements
    e.stopPropagation();
    
    // Dispatch the openUserPopup event
    const event = new CustomEvent('openUserPopup', {
      detail: {
        userId: props.userId,
        triggerElement: e.currentTarget
      },
      bubbles: false
    });
    
    document.dispatchEvent(event);
  };
  
  return (
    <span 
      class={`mention mention-user bg-primary bg-opacity-20 text-primary px-1 rounded cursor-pointer hover:bg-opacity-30 transition-colors ${props.className || ''}`}
      title={`@${displayName()}`}
      data-mention-type="user"
      data-mention-id={props.userId}
      onClick={handleClick}
    >
      @{displayName()}
    </span>
  );
};