import { Component, createEffect, createMemo, createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { useParams } from "@solidjs/router";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";
import { Avatar } from "../common/Avatar";
import { Tooltip } from "../common/Tooltip";
import UserPopupMenu from "../common/UserPopupMenu";
import { useContextMenu } from "../../lib/providers/context/ContextMenuProvider";
import Crown from "../shared/icons/Crown";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { api } from "../../lib/api";

// Types
interface RoomPermissionOverride {
  permission_id: string;
  override: 'grant' | 'deny';
}

interface RoomPermissionMember {
  user_id: string;
  overrides: RoomPermissionOverride[];
}

interface RoomPermissionRole {
  role_id: string;
  overrides: RoomPermissionOverride[];
}

interface RoomPermissions {
  members?: RoomPermissionMember[];
  roles?: RoomPermissionRole[];
}

interface MemberData {
  id: string;
  username: string;
  discriminator: string;
  display_name?: string;
  avatar?: string;
  banner?: string;
  presence?: any;
  bot?: boolean;
  spaceMember: any;
}

interface RoleGroup {
  role: any;
  members: MemberData[];
}

interface SpaceMembersListProps {
  spaceId: string | number | undefined;
  currentSpace: any;
  isMobile: boolean;
  showMembers: boolean;
  onToggleMembers: () => void;
}

export const SpaceMembersList: Component<SpaceMembersListProps> = (props) => {
  const cache = useCache();
  const { user } = useAuth();
  const { openContextMenu } = useContextMenu();
  const params = useParams();
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [roomPermissions, setRoomPermissions] = createSignal<RoomPermissions | null>(null);

  // Get current room
  const currentRoom = createMemo(() => {
    const roomId = params.roomId;
    if (!roomId) return null;
    return cache.getRoom(roomId);
  });

  // Fetch room permissions when room changes
  createEffect(async () => {
    const room = currentRoom();
    if (room && (room.type === 2 || room.type === 3 || room.type === 4)) {
      try {
        const permissions = await api.rooms.permissions.get(room.id);
        setRoomPermissions(permissions as RoomPermissions);
      } catch (error) {
        console.error('Failed to fetch room permissions:', error);
        setRoomPermissions(null);
      }
    } else {
      setRoomPermissions(null);
    }
  });

  /**
   * Checks if a member can view the current room based on permissions
   */
  const canMemberViewRoom = (memberId: string): boolean => {
    const room = currentRoom();
    if (!room) return true; // If no room selected, show all members
    
    // For DM and Group DM rooms, show all space members
    if (room.type === 0 || room.type === 1) {
      return true;
    }
    
    // For space rooms (text, voice, section), check VIEW_ROOM permission
    if (room.type === 2 || room.type === 3 || room.type === 4) {
      const spaceId = room.space_id?.toString();
      if (!spaceId) return true;
      
      // Space owners can always view all rooms
      if (props.currentSpace?.owner_id === memberId) {
        return true;
      }
      
      return checkRoomPermissions(memberId, spaceId);
    }
    
    return true;
  };

  /**
   * Checks room permissions for a specific member
   */
  const checkRoomPermissions = (memberId: string, spaceId: string): boolean => {
    const currentRoomPermissions = roomPermissions();
    
    if (currentRoomPermissions) {
      // Check member-specific overrides first
      const memberOverride = checkMemberOverrides(memberId, currentRoomPermissions);
      if (memberOverride !== null) {
        return memberOverride;
      }
      
      // Check role-specific overrides
      const roleOverride = checkRoleOverrides(memberId, spaceId, currentRoomPermissions);
      if (roleOverride !== null) {
        return roleOverride;
      }
    }
    
    // Fall back to space-level permissions
    return checkSpaceLevelPermissions(memberId, spaceId);
  };

  /**
   * Checks member-specific room permission overrides
   */
  const checkMemberOverrides = (memberId: string, permissions: RoomPermissions): boolean | null => {
    const memberOverrides = permissions.members?.find(m => m.user_id === memberId);
    if (memberOverrides) {
      const viewRoomOverride = memberOverrides.overrides?.find(o => o.permission_id === 'VIEW_ROOM');
      if (viewRoomOverride) {
        return viewRoomOverride.override === 'grant';
      }
    }
    return null;
  };

  /**
   * Checks role-specific room permission overrides
   */
  const checkRoleOverrides = (memberId: string, spaceId: string, permissions: RoomPermissions): boolean | null => {
    const member = cache.getSpaceMember(spaceId, memberId);
    if (!member) return null;
    
    const memberRoles = member.roles || [];
    
    for (const roleId of memberRoles) {
      const roleOverrides = permissions.roles?.find(r => r.role_id === roleId);
      if (roleOverrides) {
        const viewRoomOverride = roleOverrides.overrides?.find(o => o.permission_id === 'VIEW_ROOM');
        if (viewRoomOverride) {
          if (viewRoomOverride.override === 'deny') {
            return false;
          }
          if (viewRoomOverride.override === 'grant') {
            return true;
          }
        }
      }
    }
    
    return null;
  };

  /**
   * Checks space-level permissions for VIEW_ROOMS
   */
  const checkSpaceLevelPermissions = (memberId: string, spaceId: string): boolean => {
    const member = cache.getSpaceMember(spaceId, memberId);
    if (!member) return false;
    
    const roles = cache.getSpaceRoles(spaceId);
    const memberRoles = member.roles || [];
    
    // Check if any of the member's roles have VIEW_ROOMS permission
    for (const roleId of memberRoles) {
      const role = roles.find(r => r.role_id === roleId);
      if (role && role.permissions) {
        const permissions = Array.isArray(role.permissions) ? role.permissions : [];
        if (permissions.includes('VIEW_ROOMS')) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Listen for member updates
  onMount(() => {
    const handleSpaceMemberUpdate = (event: CustomEvent) => {
      const { spaceId: eventSpaceId } = event.detail;
      if (String(eventSpaceId) === String(props.spaceId)) {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    const handleSpaceMemberRoleUpdate = (event: CustomEvent) => {
      const { spaceId: eventSpaceId } = event.detail;
      if (String(eventSpaceId) === String(props.spaceId)) {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('spaceMemberUpdate', handleSpaceMemberUpdate as EventListener);
    window.addEventListener('spaceMemberRoleUpdate', handleSpaceMemberRoleUpdate as EventListener);
    
    onCleanup(() => {
      window.removeEventListener('spaceMemberUpdate', handleSpaceMemberUpdate as EventListener);
      window.removeEventListener('spaceMemberRoleUpdate', handleSpaceMemberRoleUpdate as EventListener);
    });
  });

  /**
   * Creates member data object from user and space member data
   */
  const createMemberData = (userData: any, spaceMember: any): MemberData => ({
    id: userData.id,
    username: userData.username,
    discriminator: userData.discriminator,
    display_name: userData.display_name,
    avatar: userData.avatar,
    banner: userData.banner,
    presence: userData.presence,
    bot: userData.bot,
    spaceMember
  });

  /**
   * Checks if a member is offline
   */
  const isOfflineMember = (userData: any): boolean => {
    return userData.presence?.status === "offline" || !userData.presence?.status;
  };

  /**
   * Get space members list for the sidebar, grouped by roles (if hoisted) or online/offline status
   */
  const spaceMembers = createMemo(() => {
    // Include refreshTrigger to force re-computation when roles change
    refreshTrigger();
    
    const space = props.currentSpace;
    if (!space) return { roleGroups: [], online: [], offline: [] };
    
    const members = cache.getSpaceMembers(space.id);
    const roles = cache.getSpaceRoles(space.id);
    
    // Get hoisted roles sorted by position (highest first)
    const hoistedRoles = roles
      .filter(role => role.hoist)
      .sort((a, b) => (b.position || 0) - (a.position || 0));
    
    const roleGroups: RoleGroup[] = [];
    const onlineMembers: MemberData[] = [];
    const offlineMembers: MemberData[] = [];
    const processedMembers = new Set<string>();
    
    // First, separate all members into offline and online groups
    for (const member of members) {
      const userData = cache.getUser(member.user_id);
      if (userData && canMemberViewRoom(userData.id)) {
        const memberData = createMemberData(userData, member);
        
        // Always put offline users in the offline section, regardless of roles
        if (isOfflineMember(userData)) {
          offlineMembers.push(memberData);
          processedMembers.add(member.user_id);
        }
      }
    }
    
    // Then, group online members by hoisted roles
    for (const role of hoistedRoles) {
      const roleMembers: MemberData[] = [];
      
      for (const member of members) {
        if (member.roles.includes(role.role_id) && !processedMembers.has(member.user_id)) {
          const userData = cache.getUser(member.user_id);
          if (userData && canMemberViewRoom(userData.id)) {
            const memberData = createMemberData(userData, member);
            roleMembers.push(memberData);
            processedMembers.add(member.user_id);
          }
        }
      }
      
      if (roleMembers.length > 0) {
        roleGroups.push({ role, members: roleMembers });
      }
    }
    
    // Finally, add remaining online members without hoisted roles to the online section
    for (const member of members) {
      if (!processedMembers.has(member.user_id)) {
        const userData = cache.getUser(member.user_id);
        if (userData && canMemberViewRoom(userData.id)) {
          const memberData = createMemberData(userData, member);
          onlineMembers.push(memberData);
        }
      }
    }
    
    return { roleGroups, online: onlineMembers, offline: offlineMembers };
  });

  // State for user popup menu
  const [userPopupOpen, setUserPopupOpen] = createSignal(false);
  const [userPopupTrigger, setUserPopupTrigger] = createSignal<HTMLElement | undefined>();
  const [selectedUserId, setSelectedUserId] = createSignal<string | null>(null);
  const [selectedSpaceMember, setSelectedSpaceMember] = createSignal<any | null>(null);

  /**
   * Handles member click to open user popup
   */
  const handleMemberClick = (e: MouseEvent, member: MemberData) => {
    setSelectedUserId(member.id);
    setSelectedSpaceMember(member.spaceMember);
    setUserPopupTrigger(e.currentTarget as HTMLElement);
    setUserPopupOpen(true);
  };

  /**
   * Handles member right-click context menu
   */
  const handleMemberContextMenu = (e: MouseEvent, member: MemberData) => {
    e.preventDefault();
    
    const memberContextMenu = () => {
      const isCurrentUser = user()?.id === member.id;
      
      return (
        <div class="py-1 w-full">
          {!isCurrentUser && (
            <>
              <button
                class="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors flex items-center gap-2"
                onClick={() => {
                  // TODO: Implement direct messaging functionality
                }}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message
              </button>
              <Show when={!member.bot}>
                <button
                  class="w-full px-3 py-1.5 text-left text-sm text-text-primary rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
                  onClick={() => {
                    // TODO: Implement add friend functionality
                  }}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add Friend
                </button>
              </Show>
              <div class="border-t border-border-primary my-1"></div>
            </>
          )}
          
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-text-secondary rounded-md hover:text-text-primary hover:bg-surface hover:bg-opacity-10 transition-colors flex items-center gap-2"
            onClick={() => {
              navigator.clipboard.writeText(member.id);
            }}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy User ID
          </button>
        </div>
      );
    };
    
    openContextMenu(e, memberContextMenu);
  };

  /**
   * Renders a member item in the list
   */
  const renderMember = (member: MemberData, isOffline = false) => {
    const displayName = member.spaceMember?.nick || member.display_name || member.username;
    const isSelected = userPopupOpen() && selectedUserId() === member.id;
    const isSpaceOwner = props.currentSpace?.owner_id === member.id;
    
    const getStatusText = () => {
      if (isOffline) return "Offline";
      if (member.presence?.custom_status) return member.presence.custom_status;
      if (member.presence?.status) {
        return member.presence.status.charAt(0).toUpperCase() + member.presence.status.slice(1);
      }
      return "Online";
    };

    return (
      <div
        class={`flex items-center gap-2 p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors cursor-pointer ${
          isOffline ? 'opacity-60' : ''
        } ${
          isSelected ? 'bg-surface bg-opacity-20' : ''
        }`}
        onClick={(e) => handleMemberClick(e, member)}
        onContextMenu={(e) => handleMemberContextMenu(e, member)}
      >
        <div class="relative flex-shrink-0">
          <div class="w-8 h-8 rounded-full overflow-hidden">
            <Avatar
              userId={member.id}
              avatar={member.avatar}
              alt={`${displayName}'s avatar`}
              bot={member.bot}
              size="sm"
            />
          </div>
          <StatusIndicator
            status={(isOffline ? "offline" : member.presence?.status || "offline") as UserStatus}
            class="absolute -bottom-0.5 -right-0.5 border-2 border-background1"
          />
        </div>
        <div class="flex-1 min-w-0 overflow-hidden">
          <div class="flex items-center gap-1">
            <div class="text-sm font-medium text-text-primary truncate">
              {displayName}
            </div>
            <Show when={member.bot}>
              <span class="text-xs bg-primary text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                BOT
              </span>
            </Show>
            <Show when={isSpaceOwner}>
              <Tooltip content="Space Owner" position="top">
                <Crown class="w-4 h-4 text-yellow-500 flex-shrink-0" />
              </Tooltip>
            </Show>
          </div>
          <div class="text-xs text-text-secondary truncate">
            {getStatusText()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Members sidebar - conditionally visible */}
      <div 
        class={`space-member-list bg-[var(--background1)] overflow-hidden shadow-lg transition-all pl-.5 duration-300 flex flex-col ${
          props.isMobile ? 'fixed inset-0 z-50' : 'relative h-full w-[250px] flex-shrink-0'
        }`}
        style={{ 
          display: (!props.showMembers) ? 'none' : 'flex'
        }}
      >
        <Show when={props.isMobile}>
          <div class="p-3 flex items-center justify-end sticky top-0 bg-[var(--background1)] z-10 flex-shrink-0">
            <button 
              onClick={props.onToggleMembers}
              class="p-2 rounded-full hover:bg-surface hover:bg-opacity-10 transition-colors text-text-secondary hover:text-text-primary flex-shrink-0"
              aria-label="Close members sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </Show>
        
        <div class="flex-1 overflow-y-auto min-h-0 max-h-full">
          <div class="p-2 pt-5">
            {/* Role Groups Section */}
            <For each={spaceMembers().roleGroups}>
              {(roleGroup) => (
                <div class="mb-4">
                  <h4 class="text-xs font-bold text-text-secondary uppercase mb-2 px-2 flex items-center gap-2">
                    <div
                      class="w-3 h-3 rounded-full"
                      style={{ "background-color": roleGroup.role.color || "#99aab5" }}
                    />
                    {roleGroup.role.name} — {roleGroup.members.length}
                  </h4>
                  <For each={roleGroup.members}>
                    {(member) => renderMember(member)}
                  </For>
                </div>
              )}
            </For>
            
            {/* Online Members Section */}
            <Show when={spaceMembers().online.length > 0}>
              <div class="mb-4">
                <h4 class="text-xs font-bold text-text-secondary uppercase mb-2 px-2">
                  Online — {spaceMembers().online.length}
                </h4>
                <For each={spaceMembers().online}>
                  {(member) => renderMember(member)}
                </For>
              </div>
            </Show>
            
            {/* Offline Members Section */}
            <Show when={spaceMembers().offline.length > 0}>
              <div>
                <h4 class="text-xs font-bold text-text-secondary uppercase mb-2 px-2">
                  Offline — {spaceMembers().offline.length}
                </h4>
                <For each={spaceMembers().offline}>
                  {(member) => renderMember(member, true)}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
      
      {/* User popup menu */}
      <UserPopupMenu
        isOpen={userPopupOpen()}
        onClose={() => {
          setUserPopupOpen(false);
          setSelectedSpaceMember(null);
        }}
        triggerRef={userPopupTrigger()}
        userId={selectedUserId() || ""}
        placement={userPopupTrigger()?.closest('.space-member-list') ? "left" : "right"}
        spaceId={props.currentSpace?.id?.toString()}
        spaceMember={selectedSpaceMember()}
      />
    </>
  );
};

export default SpaceMembersList;