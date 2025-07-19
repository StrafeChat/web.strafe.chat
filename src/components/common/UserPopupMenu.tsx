import {
  Component,
  Show,
  createSignal,
  onCleanup,
  createEffect,
} from "solid-js";
import { FS_URL } from "../../constants";
import { StatusIndicator } from "./StatusIndicator";
import { Avatar } from "./Avatar";
import { Portal } from "solid-js/web";
import { useCache } from "../../lib/providers/cache/CacheProvider";
// import { useAuth } from "../../lib/providers/auth/AuthProvider";
import RoleManagementModal from "../modals/RoleManagementModal";
import UserProfileModal from "../modals/UserProfileModal";
import { SpaceMember, SpaceRole } from "../../lib/cache/SpaceCache";



interface UserPopupMenuProps {
  isOpen: boolean;
  onClose: (event?: Event) => void;
  triggerRef?: HTMLElement;
  userId: string;
  placement?: "left" | "right";
  spaceId?: string; // Optional space context for role management
  spaceMember?: SpaceMember; // Space member data if in space context
}

const UserPopupMenu: Component<UserPopupMenuProps> = (props) => {
  const cache = useCache();
  // const { user: currentUser } = useAuth();
  const [user, setUser] = createSignal<any>(null);
  const [showRoleModal, setShowRoleModal] = createSignal(false);
  const [showProfileModal, setShowProfileModal] = createSignal(false);
  let popupRef: HTMLDivElement | undefined;

  // Fetch user info from cache whenever props.userId changes
  createEffect(() => {
    setUser(cache.getUser(props.userId));
  });

  // // Check if current user can manage roles in this space
  // const canManageRoles = () => {
  //   if (!props.spaceId || !props.spaceMember || !currentUser()) return false;
    
  //   const currentSpace = cache.getSpace(props.spaceId);
  //   if (!currentSpace) return false;
    
  //   // Space owner can always manage roles
  //   if (currentSpace.owner_id === currentUser()?.id) return true;
    
  //   // Don't allow managing own roles
  //   if (props.userId === currentUser()?.id) return false;
    
  //   // TODO: Check for MANAGE_ROLES permission
  //   // For now, only allow space owners
  //   return false;
  // };

  const [modalSpaceMember, setModalSpaceMember] = createSignal<any | null>(null);



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

  createEffect(() => {
    if (props.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
      onCleanup(() => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("keydown", handleKeyDown);
      });
    }
  });

  // Calculate position relative to trigger element
  const getPopupStyle = () => {
    if (!props.triggerRef) return {};

    const rect = props.triggerRef.getBoundingClientRect();
    const popupWidth = 300;
    const gap = 8;
    const minPopupHeight = 200;
    const maxPopupHeight = 500;
    
    // Calculate available space in all directions
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    let left: number;
    let top: number;
    let maxHeight = maxPopupHeight;
    
    // Horizontal positioning - prefer right, but use left if more space
    if (spaceRight >= popupWidth + gap) {
      // Position to the right of trigger
      left = rect.right + gap;
    } else if (spaceLeft >= popupWidth + gap) {
      // Position to the left of trigger
      left = rect.left - popupWidth - gap;
    } else {
      // Center horizontally if neither side has enough space
      left = Math.max(gap, (window.innerWidth - popupWidth) / 2);
    }
    
    // Vertical positioning - keep popup close to trigger
     if (spaceBelow >= minPopupHeight) {
       // Position below trigger, aligned with its top
       top = rect.top;
       maxHeight = Math.min(maxPopupHeight, spaceBelow - gap);
     } else if (spaceAbove >= minPopupHeight) {
       // Position above trigger, with bottom edge near trigger
       const availableHeight = Math.min(maxPopupHeight, spaceAbove - gap);
       top = rect.top - availableHeight;
       maxHeight = availableHeight;
     } else {
       // Limited space - position to keep some part near trigger
       maxHeight = Math.min(maxPopupHeight, window.innerHeight - gap * 2);
       if (spaceBelow > spaceAbove) {
         // More space below - align top with trigger
         top = rect.top;
       } else {
         // More space above - align bottom with trigger
         top = rect.bottom - maxHeight;
       }
     }
    
    // Final bounds checking
    if (left < gap) left = gap;
    if (left + popupWidth > window.innerWidth - gap) {
      left = window.innerWidth - popupWidth - gap;
    }
    
    if (top < gap) {
      top = gap;
      maxHeight = Math.min(maxHeight, window.innerHeight - gap * 2);
    }
    
    if (top + maxHeight > window.innerHeight - gap) {
      maxHeight = window.innerHeight - top - gap;
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
      maxHeight: `${maxHeight}px`,
    };
  };

  return (
    <div class="relative">
      <Show when={props.isOpen && props.triggerRef && user()}>
        <Portal>
          <div
            ref={popupRef}
            class="fixed z-50 bg-background2 rounded-lg shadow-lg w-[300px] overflow-y-auto animate-fade-in"
            style={getPopupStyle()}
            onClick={(e) => e.stopPropagation()}
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
                  onError={e => {
                    // Hide the banner image if it fails to load
                    e.currentTarget.style.display = 'none';
                    // Show the fallback background
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.style.background = 'var(--primary)';
                    }
                  }}
                />
              </Show>
              <div class="absolute -bottom-6 left-2">
                <div class="relative w-[80px] h-[80px]">
                  <div 
                    class="w-full h-full rounded-full overflow-hidden border-4 border-background2 cursor-pointer hover:border-primary transition-colors" 
                    style={{ "aspect-ratio": "1/1" }}
                    onClick={() => {
                      setShowProfileModal(true);
                      props.onClose();
                    }}
                  >
                    <Avatar
                      userId={user()?.id || ''}
                      avatar={user()?.avatar}
                      alt="User avatar"
                      class="!w-[72px] !h-[72px] !rounded-full object-cover"
                    />
                  </div>
                  <div class="absolute bottom-0.5 right-0.5">
                    <StatusIndicator
                      status={user()?.presence?.status || "offline"}
                      class="w-7 h-7 border-[6px] border-background2 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Badge Section */}
            <div class="absolute top-[113px] right-3">
              <div class="inline-flex items-center gap-1.5 bg-[#111214] px-1.5 py-1 rounded-md">
                <button class="w-5 h-5 rounded-[4px] flex items-center justify-center group cursor-pointer hover:bg-[#2b2d31] transition-colors">
                  <svg class="w-3.5 h-3.5 text-[#b5bac1] group-hover:text-[#dbdee1]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L8.5 8.5 2 9.8l5 4.9L5.8 22 12 18.5 18.2 22 17 14.7l5-4.9-6.5-1.3z"/>
                  </svg>
                </button>
              </div>
            </div>
            {/* User Info */}
            <div class="mt-4 p-4">
              <div class="font-semibold text-lg">{user()?.display_name}</div>
              <div class="text-sm text-text-secondary">
                {user()?.username}#
                {String(user()?.discriminator).padStart(4, "0")}
              </div>

              {/* About Me Section */}
              <Show when={(user()?.about_me || user()?.AboutMe) && (user()?.about_me || user()?.AboutMe)?.trim().length > 0}>
                <div class="w-full pt-4">
                  <div class="w-full py-2 bg-opacity-5 rounded-md">
                    <div class="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">About Me</div>
                    <div class="text-sm text-text-primary whitespace-pre-wrap break-words">
                      {user()?.about_me || user()?.AboutMe}
                    </div>
                  </div>
                </div>
              </Show>

              {/* Roles Section (if in space context) */}
              <Show when={props.spaceId && props.spaceMember}>
                {(() => {
                  const spaceRoles = cache.getSpaceRoles(props.spaceId!);
                  const userRoles = spaceRoles.filter((role: SpaceRole) => 
                    props.spaceMember?.roles?.includes(role.role_id)
                  ) || [];
                  
                  return (
                    <Show when={userRoles.length > 0}>
                      <div class="w-full pt-4">
                        <div class="w-full py-1 bg-opacity-5 rounded-md">
                          <div class="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wide">
                            Roles — {userRoles.length}
                          </div>
                          <div class="flex flex-wrap gap-2">
                            {userRoles.map((role: SpaceRole) => (
                              <div 
                                class="px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 border-[1px] border-border-primary"
                                                            >
                                <div
                                  class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ "background-color": role.color || "var(--surface)" }}
                                />
                                <span class="truncate">{role.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Show>
                  );
                })()}
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
      
      {/* Role Management Modal */}
      <RoleManagementModal
        isOpen={showRoleModal()}
        onClose={() => {
          setShowRoleModal(false);
          setModalSpaceMember(null);
        }}
        member={modalSpaceMember()}
        spaceId={props.spaceId || ""}
      />
      
      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal()}
        onClose={() => setShowProfileModal(false)}
        userId={props.userId}
        spaceId={props.spaceId}
      />
    </div>
  );
};

export default UserPopupMenu;