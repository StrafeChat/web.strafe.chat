import { Component, JSX, createSignal, createEffect } from "solid-js";
import { FS_URL } from "../../constants";
import User from "../shared/icons/User";

interface AvatarProps {
  userId: string;
  avatar?: string | null;
  alt?: string;
  class?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  onClick?: JSX.EventHandlerUnion<HTMLImageElement, MouseEvent>;
}

type FallbackState = "original" | "user-default" | "global-default";

/**
 * Avatar component that displays a user's avatar with robust fallback system
 */
export const Avatar: Component<AvatarProps> = (props) => {
  const [fallbackState, setFallbackState] = createSignal<FallbackState>("original");
  
  // Reset fallback state when props change to prevent stale states
  createEffect(() => {
    setFallbackState("original");
  }, [props.userId, props.avatar]);
  
  // Size classes mapping
  const sizeClasses = {
    xs: "w-4 h-4",
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    xl: "w-20 h-20"
  };
  
  // Get the size class or default to medium
  const getSizeClass = () => {
    return sizeClasses[props.size || "md"];
  };
  
  // Get the avatar URL with progressive fallback handling
  const getAvatarUrl = () => {
    const state = fallbackState();
    
    switch (state) {
      case "original":
        if (props.avatar) {
          return `${FS_URL}/avatars/${props.userId}/${props.avatar}`;
        }
        // If no avatar provided, go directly to user default
        return `${FS_URL}/avatars/${props.userId}/default.webp`;
      
      case "user-default":
        return `${FS_URL}/avatars/${props.userId}/default.webp`;
      
      case "global-default":
        // Return null to indicate we should show the SVG icon
        return null;
      
      default:
        return `${FS_URL}/avatars/${props.userId}/default.webp`;
    }
  };
  
  // Handle image load error with progressive fallback
  const handleError = () => {
    const currentState = fallbackState();
    
    if (currentState === "original") {
      setFallbackState("user-default");
    } else if (currentState === "user-default") {
      setFallbackState("global-default");
    }
    // If already at global-default, don't change state to prevent infinite loops
  };
  
  // Use a reactive computation to get the avatar URL
  const avatarUrl = () => getAvatarUrl();
  
  return (
    <>
      {avatarUrl() === null ? (
        <div 
          class={`rounded-full bg-surface bg-opacity-20 flex items-center justify-center ${getSizeClass()} ${props.class || ""}`}
          onClick={props.onClick as unknown as JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>}
        >
          <User />
        </div>
      ) : (
        <img
          src={avatarUrl()!}
          alt={props.alt || "User avatar"}
          class={`rounded-full object-cover ${getSizeClass()} ${props.class || ""}`}
          onError={handleError}
          onClick={props.onClick}
          loading="lazy"
        />
      )}
    </>
  );
};