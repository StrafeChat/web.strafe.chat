import {
  Component,
  Show,
  createSignal,
  onCleanup,
  onMount,
  createEffect,
} from "solid-js";
import { Avatar } from "./Avatar";
import { FS_URL } from "../../constants";
import { StatusIndicator } from "./StatusIndicator";
import { Portal } from "solid-js/web";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { UserBadges } from "./UserBadges";

interface UserPopupMenuProps {
  isOpen: boolean;
  onClose: (event?: Event) => void;
  triggerRef?: HTMLElement;
  userId: string;
  placement?: "left" | "right";
}

const UserPopupMenu: Component<UserPopupMenuProps> = (props) => {
  const cache = useCache();
  const [user, setUser] = createSignal<any>(null);
  let popupRef: HTMLDivElement | undefined;

  // Fetch user info from cache whenever props.userId changes
  createEffect(() => {
    setUser(cache.getUser(props.userId));
  });

  // Handle clicking outside to close
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    const clickedTrigger = props.triggerRef?.contains(target);
    const clickedPopup = popupRef?.contains(target);
    if (!clickedTrigger && !clickedPopup) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
  });
  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    window.removeEventListener("keydown", handleKeyDown);
  });

  // Calculate position relative to trigger element
  const getPopupStyle = () => {
    if (!props.triggerRef) return {};
    const rect = props.triggerRef.getBoundingClientRect();
    const popupWidth = 320;
    const gap = 10;
    let left: number;
    let top = rect.top + rect.height / 2 - 80; // vertically center popup avatar
    if (props.placement === "left") {
      left = rect.left - popupWidth - gap;
      // Ensure popup is fully to the left, not overlapping the trigger
      if (left < gap) left = gap;
    } else {
      left = rect.right + gap;
      if (left + popupWidth > window.innerWidth - gap) {
        left = window.innerWidth - popupWidth - gap;
      }
    }
    // Clamp top if popup would go offscreen
    if (top < gap) top = gap;
    if (top + 200 > window.innerHeight - gap) top = window.innerHeight - 200 - gap;
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${popupWidth}px`,
      maxHeight: `calc(100vh - 40px)`
    };
  };

  return (
    <div class="relative">
      <Show when={props.isOpen && props.triggerRef && user()}>
        <Portal>
          <div
            class="fixed inset-0 bg-black bg-opacity-0 z-40"
            onClick={props.onClose}
          />
          <div
            ref={popupRef}
            class="fixed z-50 bg-background2 rounded-lg shadow-lg overflow-hidden animate-fade-in"
            style={getPopupStyle()}
            onClick={e => e.stopPropagation()}
          >
            {/* Banner & Avatar */}
            <div class="h-[100px] relative">
              <Show
                when={user()?.banner}
                fallback={<div class="h-full w-full bg-primary" />}
              >
                <img
                  src={`${FS_URL}/banners/${user()?.id}/${user()?.banner}`}
                  alt="User banner"
                  class="w-full h-full object-cover"
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              </Show>
              <div class="absolute -bottom-6 left-2">
                <div class="relative w-[80px] h-[80px]">
                  <Avatar
                    userId={user()?.id}
                    avatar={user()?.avatar}
                    alt={user()?.display_name || user()?.username}
                    size="xl"
                    class="border-4 border-background2"
                  />
                  <div class="absolute bottom-0.5 right-0.5">
                    <StatusIndicator
                      status={user()?.presence?.status || "offline"}
                      class="w-7 h-7 border-[6px] border-background2 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* User Info */}
            <div class="mt-4 p-4">
              <div class="font-semibold text-lg">{user()?.display_name}</div>
              <div class="text-sm text-text-secondary">
                {user()?.username}#
                {String(user()?.discriminator).padStart(4, "0")}
              </div>
              {/* Badges */}
              <Show when={user()?.badges && user()?.badges.length > 0}>
                <UserBadges badges={user()?.badges.map((id: string) => ({ id, name: id, icon: undefined }))} />
              </Show>
              {/* About Me */}
              <Show when={user()?.about_me}>
                <div class="mt-3 px-2 py-2 rounded bg-surface bg-opacity-10 text-text-primary whitespace-pre-line text-sm">
                  {user()?.about_me}
                </div>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};

export default UserPopupMenu;
