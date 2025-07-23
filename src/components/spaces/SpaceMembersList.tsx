import { Component, createMemo, createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { StatusIndicator, UserStatus } from "../common/StatusIndicator";
import { Avatar } from "../common/Avatar";
import { Tooltip } from "../common/Tooltip";
import UserPopupMenu from "../common/UserPopupMenu";
import Crown from "../shared/icons/Crown";

interface SpaceMembersListProps {
  spaceId: string | number | undefined;
  currentSpace: any;
  isMobile: boolean;
  showMembers: boolean;
  onToggleMembers: () => void;
}

export const SpaceMembersList: Component<SpaceMembersListProps> = (props) => {
  const cache = useCache();
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);

  // Listen for member updates
  onMount(() => {
    const handleSpaceMemberUpdate = (event: CustomEvent) => {
        console.log('[SpaceMembersList] Received spaceMemberUpdate event:', event.detail);
        const { spaceId: eventSpaceId } = event.detail;
        console.log(`[SpaceMembersList] Type check: typeof eventSpaceId = ${typeof eventSpaceId}, typeof props.spaceId = ${typeof props.spaceId}`);
        console.log(`[SpaceMembersList] String comparison: "${String(eventSpaceId)}" vs "${String(props.spaceId)}"`);
        if (String(eventSpaceId) === String(props.spaceId)) {
          console.log(`[SpaceMembersList] Refreshing members list for space ${props.spaceId}`);
          setRefreshTrigger(prev => prev + 1);
        } else {
          console.log(`[SpaceMembersList] Event for different space: ${eventSpaceId} vs ${props.spaceId}`);
        }
      };

     const handleSpaceMemberRoleUpdate = (event: CustomEvent) => {
        console.log('[SpaceMembersList] Received spaceMemberRoleUpdate event:', event.detail);
        const { spaceId: eventSpaceId } = event.detail;
        console.log(`[SpaceMembersList] Type check: typeof eventSpaceId = ${typeof eventSpaceId}, typeof props.spaceId = ${typeof props.spaceId}`);
        console.log(`[SpaceMembersList] String comparison: "${String(eventSpaceId)}" vs "${String(props.spaceId)}"`);
        if (String(eventSpaceId) === String(props.spaceId)) {
          console.log('[SpaceMembersList] Member roles updated, refreshing list');
          setRefreshTrigger(prev => prev + 1);
        } else {
          console.log(`[SpaceMembersList] Role update for different space: ${eventSpaceId} vs ${props.spaceId}`);
        }
      };

    window.addEventListener('spaceMemberUpdate', handleSpaceMemberUpdate as EventListener);
    window.addEventListener('spaceMemberRoleUpdate', handleSpaceMemberRoleUpdate as EventListener);
    
    onCleanup(() => {
      window.removeEventListener('spaceMemberUpdate', handleSpaceMemberUpdate as EventListener);
      window.removeEventListener('spaceMemberRoleUpdate', handleSpaceMemberRoleUpdate as EventListener);
    });
  });

  // Get space members list for the sidebar, grouped by roles (if hoisted) or online/offline status
  const spaceMembers = createMemo(() => {
    // Include refreshTrigger to force re-computation when roles change
    refreshTrigger();
    
    const space = props.currentSpace;
    if (!space) return { roleGroups: [], online: [], offline: [] };
    
    const members = cache.getSpaceMembers(space.id);
    const roles = cache.getSpaceRoles(space.id);
    
    // Create a map of role ID to role data for quick lookup
    const roleMap = new Map();
    roles.forEach(role => {
      roleMap.set(role.role_id, role);
    });
    
    // Get hoisted roles sorted by position (highest first)
    const hoistedRoles = roles
      .filter(role => role.hoist)
      .sort((a, b) => (b.position || 0) - (a.position || 0));
    
    const roleGroups = [];
    const onlineMembers = [];
    const offlineMembers = [];
    const processedMembers = new Set();
    
    // First, separate all members into offline and online groups
    for (const member of members) {
      const userData = cache.getUser(member.user_id);
      if (userData) {
        const memberData = {
          id: userData.id,
          username: userData.username,
          discriminator: userData.discriminator,
          display_name: userData.display_name,
          avatar: userData.avatar,
          banner: userData.banner,
          presence: userData.presence,
          spaceMember: member
        };
        
        // Always put offline users in the offline section, regardless of roles
        if (userData.presence?.status === "offline" || !userData.presence?.status) {
          offlineMembers.push(memberData);
          processedMembers.add(member.user_id);
        }
      }
    }
    
    // Then, group online members by hoisted roles
    for (const role of hoistedRoles) {
      const roleMembers = [];
      
      for (const member of members) {
        if (member.roles.includes(role.role_id) && !processedMembers.has(member.user_id)) {
          const userData = cache.getUser(member.user_id);
          if (userData) {
            const memberData = {
              id: userData.id,
              username: userData.username,
              discriminator: userData.discriminator,
              display_name: userData.display_name,
              avatar: userData.avatar,
              banner: userData.banner,
              presence: userData.presence,
              spaceMember: member
            };
            roleMembers.push(memberData);
            processedMembers.add(member.user_id);
          }
        }
      }
      
      if (roleMembers.length > 0) {
        roleGroups.push({
          role: role,
          members: roleMembers
        });
      }
    }
    
    // Finally, add remaining online members without hoisted roles to the online section
    for (const member of members) {
      if (!processedMembers.has(member.user_id)) {
        const userData = cache.getUser(member.user_id);
        if (userData) {
          const memberData = {
            id: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            display_name: userData.display_name,
            avatar: userData.avatar,
            banner: userData.banner,
            presence: userData.presence,
            spaceMember: member
          };
          onlineMembers.push(memberData);
        }
      }
    }
    
    return { roleGroups, online: onlineMembers, offline: offlineMembers };
  });

  // Add state for user popup menu for members
  const [userPopupOpen, setUserPopupOpen] = createSignal(false);
  const [userPopupTrigger, setUserPopupTrigger] = createSignal<HTMLElement | undefined>();
  const [selectedUserId, setSelectedUserId] = createSignal<string | null>(null);
  const [selectedSpaceMember, setSelectedSpaceMember] = createSignal<any | null>(null);

  const handleMemberClick = (e: MouseEvent, member: any) => {
    setSelectedUserId(member.id);
    setSelectedSpaceMember(member.spaceMember);
    setUserPopupTrigger(e.currentTarget as HTMLElement);
    setUserPopupOpen(true);
  };

  const handleMemberContextMenu = (e: MouseEvent, member: any) => {
    e.preventDefault();
    setSelectedUserId(member.id);
    setSelectedSpaceMember(member.spaceMember);
    setUserPopupTrigger(e.currentTarget as HTMLElement);
    setUserPopupOpen(true);
  };

  const renderMember = (member: any, isOffline = false) => (
    <div
      class={`flex items-center gap-2 p-2 rounded-md hover:bg-surface hover:bg-opacity-10 transition-colors cursor-pointer ${
        isOffline ? 'opacity-60' : ''
      } ${
        userPopupOpen() && selectedUserId() === member.id 
          ? 'bg-surface bg-opacity-20' 
          : ''
      }`}
      onClick={(e) => handleMemberClick(e, member)}
      onContextMenu={(e) => handleMemberContextMenu(e, member)}
    >
      <div class="relative flex-shrink-0">
        <div class="w-8 h-8 rounded-full overflow-hidden">
          <Avatar
            userId={member.id}
            avatar={member.avatar}
            alt={`${member.display_name || member.username}'s avatar`}
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
            {member.spaceMember?.nick || member.display_name || member.username}
          </div>
          {/* Crown icon for space owner */}
          <Show when={props.currentSpace?.owner_id === member.id}>
            <Tooltip content="Space Owner" position="top">
              <Crown class="w-4 h-4 text-yellow-500 flex-shrink-0" />
            </Tooltip>
          </Show>
        </div>
        <div class="text-xs text-text-secondary truncate">
          {isOffline 
            ? "Offline"
            : member.presence?.custom_status || 
              (member.presence?.status ? member.presence.status.charAt(0).toUpperCase() + member.presence.status.slice(1) : "Online")
          }
        </div>
      </div>
    </div>
  );

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