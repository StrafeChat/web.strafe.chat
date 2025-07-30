import { Component, createSignal, createMemo, For, createEffect } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { Space } from "../../../lib/cache/SpaceCache";
import { Avatar } from "../../common/Avatar";
import RoleManagementModal from "../../modals/RoleManagementModal";
import Users from "../../shared/icons/Users";
import Search from "../../shared/icons/Search";
import Crown from "../../shared/icons/Crown";
import Shield from "../../shared/icons/Shield";
import Kick from "../../shared/icons/Kick";
import Ban from "../../shared/icons/Ban";
import Settings from "../../shared/icons/Settings";
import Link from "../../shared/icons/Link";
import { api } from "../../../lib/api";
import { useCache } from "../../../lib/providers/cache/CacheProvider";
import SpaceInvitesSettings from "./SpaceInvitesSettings";

import { SpaceMember } from "../../../lib/cache/SpaceCache";

interface SpaceMembersSettingsProps {
  space: Space;
}

const SpaceMembersSettings: Component<SpaceMembersSettingsProps> = (props) => {
  const { isMobile, user } = useAuth();
  const { getUser, getCachedSpaceMembers, getSpaceMembers, getCachedSpaceRoles, setCachedSpaceMembers, setCachedSpaceRoles, removeSpaceMember } = useCache();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [activeTab, setActiveTab] = createSignal<"members" | "invites">("members");

  const [showRoleModal, setShowRoleModal] = createSignal(false);
  const [selectedMember, setSelectedMember] = createSignal<SpaceMember | null>(null);

  // Cache-aware data fetching
  const [, setMembersLoading] = createSignal(false);
  const [, setRolesLoading] = createSignal(false);
  const [, setMembersError] = createSignal<string | null>(null);
  const [, setRolesError] = createSignal<string | null>(null);

  const fetchMembersIfNeeded = async () => {
    const spaceId = props.space.id.toString();
    
    // Check if we have valid cached data
    const cachedMembers = getCachedSpaceMembers(spaceId);
    if (cachedMembers && cachedMembers.length > 0) {
      return;
    }

    setMembersLoading(true);
    setMembersError(null);
    
    try {
      const response = await api.spaces.members.list(spaceId) as { members: any[] };
      setCachedSpaceMembers(spaceId, response.members || []);
    } catch (error) {
      console.error("Failed to fetch space members:", error);
      setMembersError("Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchRolesIfNeeded = async () => {
    const spaceId = props.space.id.toString();
    
    // Check if we have valid cached data
    const cachedRoles = getCachedSpaceRoles(spaceId);
    if (cachedRoles) {
      return;
    }

    setRolesLoading(true);
    setRolesError(null);
    
    try {
      const response = await api.spaces.roles.list(spaceId) as { roles: any[] };
      setCachedSpaceRoles(spaceId, response.roles || []);
    } catch (error) {
      console.error("Failed to fetch space roles:", error);
      setRolesError("Failed to load roles");
    } finally {
      setRolesLoading(false);
    }
  };

  // Fetch data on mount and when space changes
  createEffect(() => {
    fetchMembersIfNeeded();
    fetchRolesIfNeeded();
  });

  // Manual refresh function (unused but kept for future use)
  // const _handleRefresh = async () => {
  //   const spaceId = props.space.id.toString();
  //   
  //   setMembersLoading(true);
  //   setRolesLoading(true);
  //   setMembersError(null);
  //   setRolesError(null);
  //   
  //   try {
  //     const [membersResponse, rolesResponse] = await Promise.all([
  //       api.spaces.members.list(spaceId),
  //       api.spaces.roles.list(spaceId)
  //     ]) as [{ members: any[] }, { roles: any[] }];
  //     
  //     cache.setCachedSpaceMembers(spaceId, membersResponse.members || []);
  //     cache.setCachedSpaceRoles(spaceId, rolesResponse.roles || []);
  //   } catch (error) {
  //     console.error("Failed to refresh data:", error);
  //     setMembersError("Failed to refresh members");
  //     setRolesError("Failed to refresh roles");
  //   } finally {
  //     setMembersLoading(false);
  //     setRolesLoading(false);
  //   }
  // };





  const isOwner = () => props.space.owner_id === user()?.id;
  const canManageMembers = () => isOwner(); // TODO: Add role-based permissions

  const members = createMemo(() => {
    const spaceId = props.space.id.toString();
    const cachedMembers = getCachedSpaceMembers(spaceId);
    const fallbackMembers = getSpaceMembers(spaceId);
    
    const rawMembers = cachedMembers || fallbackMembers || [];
    
    // Enhance members with user data from user cache if missing
    return rawMembers.map(member => {
      // If member already has complete user data, return as is
      if (member.user && member.user.username && member.user.display_name) {
        return member;
      }
      
      // Otherwise, try to get user data from user cache
      const userData = getUser(member.user_id);
      if (userData) {
        return {
          ...member,
          user: {
            id: userData.id,
            username: userData.username,
            display_name: userData.display_name || userData.username,
            discriminator: Number(userData.discriminator) || 0,
            avatar: userData.avatar || '',
            banner: userData.banner || '',
            bot: userData.bot || false,
            system: userData.system || false,
            bio: userData.bio || '',
            about_me: userData.about_me || '',
            flags: userData.flags || 0,
            presence: userData.presence || {
              status: 'offline',
              custom_status: ''
            }
          }
        };
      }
      
      // If no user data found, return member with fallback user data
      return {
        ...member,
        user: member.user || {
          id: member.user_id,
          username: `user_${member.user_id}`,
          display_name: `User ${member.user_id}`,
          discriminator: 0,
          avatar: '',
          banner: '',
          bot: false,
          system: false,
          bio: '',
          about_me: '',
          flags: 0,
          presence: {
            status: 'offline',
            custom_status: ''
          }
        }
      };
    });
  });
  // const roles = createMemo(() => cache.getCachedSpaceRoles(props.space.id.toString()) || []);

  const filteredMembers = () => {
    const query = searchQuery().toLowerCase();
    const allMembers = members();
    
    return allMembers.filter((member: any) => {
      // Handle both API response format (flat) and cache format (nested user object)
      const username = member.user?.username || member.username || '';
      const displayName = member.user?.display_name || member.display_name || '';
      
      // If no search query, show all members
      if (!query) {
        return true;
      }
      
      // Filter by username or display name
      const matchesUsername = username && username.toLowerCase().includes(query);
      const matchesDisplayName = displayName && displayName.toLowerCase().includes(query);
      
      return matchesUsername || matchesDisplayName;
    });
  };

  const handleKickMember = async (memberId: string) => {
     try {
       await api.spaces.members.kick(props.space.id.toString(), memberId);
       // Remove member from cache
       removeSpaceMember(props.space.id.toString(), memberId);
     } catch (error) {
       console.error("Failed to kick member:", error);
     }
   };

   const handleBanMember = async (memberId: string) => {
     // TODO: Implement ban functionality
     console.log("Ban member:", memberId);
   };

   const handleManageRoles = (member: SpaceMember) => {
     setSelectedMember(member);
     setShowRoleModal(true);
   };

  // Handle updating member roles (unused but kept for future use)
  // const handleUpdateMemberRoles = async (memberUserId: string, newRoles: string[]) => {
  //   try {
  //     await api.spaces.members.updateRoles(props.space.id.toString(), memberUserId, newRoles);
  //     // Update member roles in cache
  //     const currentMember = cache.getSpaceMember(props.space.id.toString(), memberUserId);
  //     if (currentMember) {
  //       const updatedMember = { ...currentMember, roles: newRoles };
  //       cache.updateCachedSpaceMember(props.space.id.toString(), updatedMember);
  //     }
  //     setShowRoleModal(false);
  //     setSelectedMember(null);
  //   } catch (error) {
  //     console.error("Failed to update member roles:", error);
  //   }
  // };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "idle": return "bg-yellow-500";
      case "dnd": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };



  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-blue-500/10 rounded-lg">
          <Users />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            Members
          </h2>
          <p class="text-text-secondary text-xs">
            Manage members and invitations for your space
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("members")}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab() === "members"
              ? "bg-primary text-white"
              : "bg-background1 text-text-secondary hover:text-text-primary"
          }`}
        >
          <Users class="w-4 h-4" />
          Members ({members().length})
        </button>
        <button
          onClick={() => setActiveTab("invites")}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab() === "invites"
              ? "bg-primary text-white"
              : "bg-background1 text-text-secondary hover:text-text-primary"
          }`}
        >
          <Link class="w-4 h-4" />
           <span>Invites</span>
        </button>
      </div>

      {/* Members Tab */}
      {activeTab() === "members" && (
        <div class="space-y-6">
          {/* Search */}
          <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search members..."
              class="w-full pl-10 pr-4 py-3 bg-background1 border border-border rounded-lg text-text-primary placeholder-text-secondary"
            />
          </div>

          {/* Members List */}
          <div class="bg-background1 rounded-lg">
            <div class="p-4 border-b border-border">
              <h3 class="text-lg font-semibold text-text-primary">Space Members</h3>
            </div>
            <div class="divide-y divide-border">
              <For each={filteredMembers()}>
                {(member) => (
                  <div class="p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="relative">
                        <Avatar 
                          userId={member.user_id}
                          avatar={member.user?.avatar || (member as any).avatar}
                          size="md"
                          alt={member.user?.display_name || member.user?.username || (member as any).display_name || (member as any).username || 'Unknown User'}
                        />
                        <div class={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(member.user?.presence?.status || (member as any).status || 'offline')} rounded-full border-2 border-background1`} />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-text-primary font-medium">
                            {member.user?.display_name || member.user?.username || (member as any).display_name || (member as any).username || 'Unknown User'}
                          </span>
                          {(props.space.owner_id === member.user_id) && (
                            <Crown class="w-4 h-4 text-yellow-500" />
                          )}
                          {member.roles && member.roles.length > 0 && (
                            <Shield />
                          )}
                        </div>
                        <div class="text-sm text-text-secondary">@{member.user?.username || (member as any).username || 'unknown'}#{(member.user?.discriminator || (member as any).discriminator || 0).toString().padStart(4, "0")}</div>
                        <div class="text-xs text-text-secondary">Joined {formatDate(member.joined_at)}</div>
                        {member.roles && member.roles.length > 0 && (
                          <div class="text-xs text-blue-400 mt-1">
                            Roles: {member.roles.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {canManageMembers() && props.space.owner_id !== member.user_id && member.user_id !== user()?.id && (
                      <div class="flex gap-2">
                        <button
                          onClick={() => handleManageRoles(member as SpaceMember)}
                          class="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Manage Roles"
                        >
                          <Settings />
                        </button>
                        <button
                          onClick={() => handleKickMember(member.user_id)}
                          class="p-2 text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                          title="Kick Member"
                        >
                          <Kick />
                        </button>
                        <button
                          onClick={() => handleBanMember(member.user_id)}
                          class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Ban Member"
                        >
                          <Ban />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </For>
              
              {filteredMembers().length === 0 && (
                <div class="p-8 text-center text-text-secondary">
                  <Users class="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No members found</p>
                  <p class="text-sm mt-2">Total cached members: {members().length}</p>
                  <p class="text-sm">Search query: "{searchQuery()}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invites Tab */}
      {activeTab() === "invites" && (
        <SpaceInvitesSettings space={props.space} />
      )}

      {/* Role Management Modal */}
      <RoleManagementModal
        isOpen={showRoleModal()}
        onClose={() => {
          setShowRoleModal(false);
          setSelectedMember(null);
        }}
        member={selectedMember()}
        spaceId={props.space.id.toString()}
      />
    </div>
  );
};

export default SpaceMembersSettings;