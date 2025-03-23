import { Component, JSX, createSignal } from "solid-js";
import { FS_URL } from "../../constants";

interface AvatarProps {
  userId: string;
  avatar?: string | null;
  alt?: string;
  class?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onClick?: JSX.EventHandlerUnion<HTMLImageElement, MouseEvent>;
}

/**
 * Avatar component that displays a user's avatar with fallback to default.webp
 */
export const Avatar: Component<AvatarProps> = (props) => {
  const [error, setError] = createSignal(false);
  
  // Size classes mapping
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    xl: "w-20 h-20"
  };
  
  // Get the size class or default to medium
  const getSizeClass = () => {
    return sizeClasses[props.size || "md"];
  };
  
  // Get the avatar URL with fallback handling
  const getAvatarUrl = () => {
    if (error()) {
      // If there was an error loading the avatar, use default
      return `${FS_URL}/avatars/${props.userId}/default.webp`;
    }
    
    if (!props.avatar) {
      // If no avatar is provided, use default
      return `${FS_URL}/avatars/${props.userId}/default.webp`;
    }
    
    // Use the user's avatar
    return `${FS_URL}/avatars/${props.userId}/${props.avatar}`;
  };
  
  // Handle image load error
  const handleError = () => {
    setError(true);
  };
  
  return (
    <img
      src={getAvatarUrl()}
      alt={props.alt || "User avatar"}
      class={`rounded-full object-cover ${getSizeClass()} ${props.class || ""}`}
      onError={handleError}
      onClick={props.onClick}
    />
  );
};