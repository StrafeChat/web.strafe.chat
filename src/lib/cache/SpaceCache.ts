export interface Space {
  id: string;
  name: string;
  name_acronym: string;
  description?: string;
  icon?: string;
  banner?: string;
  owner_id: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  features: string[];
  afk_room_id?: string;
  afk_timeout: number;
  system_room_id?: string;
  system_room_flags: number;
  rules_room_id?: string;
  max_presences?: number;
  max_members?: number;
  vanity_url_code?: string;
  preferred_locale: string;
  public_updates_room_id?: string;
  max_video_room_users?: number;
  nsfw_level: number;

  created_at: string;
  updated_at: string;
}

export interface SpaceMember {
  space_id: string;
  user_id: string;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending: boolean;
  permissions?: string;
  communication_disabled_until?: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    discriminator: number;
    avatar?: string;
    banner?: string;
    bot: boolean;
    system: boolean;
    bio?: string;
    about_me?: string;
    flags: number;
    presence: {
      status: string;
      custom_status?: string;
    };
  };
}

export interface SpaceRole {
  role_id: string;
  name: string;
  description?: string;
  color?: string;
  hoist?: boolean;
  mentionable?: boolean;
  position?: number;
}

interface CacheEntry<T> {
  data: T;
  lastFetched: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class SpaceCache {
  private spaces: Map<string, Space> = new Map();
  private spaceMembers: Map<string, Map<string, SpaceMember>> = new Map(); // spaceId -> userId -> SpaceMember
  private spaceMembersCache: Map<string, CacheEntry<SpaceMember[]>> = new Map(); // spaceId -> cached members
  private spaceRoles: Map<string, Map<string, SpaceRole>> = new Map(); // spaceId -> roleId -> SpaceRole
  private spaceRolesCache: Map<string, CacheEntry<SpaceRole[]>> = new Map(); // spaceId -> cached roles
  private userSpaces: Map<string, string[]> = new Map(); // userId -> spaceIds
  private spaceUpdateCallbacks: ((spaceId: string, space: Space) => void)[] = [];

  public setSpace(space: Space): void {
    this.spaces.set(space.id, space);
    this.notifySpaceUpdate(space.id, space);
  }

  public getSpace(spaceId: string): Space | undefined {
    return this.spaces.get(spaceId);
  }

  public getAllSpaces(): Space[] {
    return Array.from(this.spaces.values());
  }

  public getUserSpaces(userId: string): Space[] {
    const spaceIds = this.userSpaces.get(userId) || [];
    return spaceIds.map(id => this.spaces.get(id)).filter(Boolean) as Space[];
  }

  public addUserToSpace(userId: string, spaceId: string): void {
    const userSpaces = this.userSpaces.get(userId) || [];
    if (!userSpaces.includes(spaceId)) {
      this.userSpaces.set(userId, [...userSpaces, spaceId]);
    }
  }

  public removeUserFromSpace(userId: string, spaceId: string): void {
    const userSpaces = this.userSpaces.get(userId) || [];
    this.userSpaces.set(userId, userSpaces.filter(id => id !== spaceId));
  }

  public setSpaceMember(spaceMember: SpaceMember): void {
    if (!this.spaceMembers.has(spaceMember.space_id)) {
      this.spaceMembers.set(spaceMember.space_id, new Map());
    }
    this.spaceMembers.get(spaceMember.space_id)!.set(spaceMember.user_id, spaceMember);
    
    // Also update user spaces mapping
    this.addUserToSpace(spaceMember.user_id, spaceMember.space_id);
  }

  public getSpaceMember(spaceId: string, userId: string): SpaceMember | undefined {
    return this.spaceMembers.get(spaceId)?.get(userId);
  }

  public getCachedSpaceMember(spaceId: string, userId: string): SpaceMember | undefined {
    return this.spaceMembers.get(spaceId)?.get(userId);
  }

  public getSpaceMembers(spaceId: string): SpaceMember[] {
    const members = this.spaceMembers.get(spaceId);
    return members ? Array.from(members.values()) : [];
  }

  public getCachedSpaceMembers(spaceId: string): SpaceMember[] | null {
    const cached = this.spaceMembersCache.get(spaceId);
    if (cached && Date.now() - cached.lastFetched < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  public setCachedSpaceMembers(spaceId: string, members: SpaceMember[]): void {
    const now = Date.now();
    
    // Filter out members that were recently updated to prevent overwriting
    const filteredMembers = members.filter(member => {
      const updateKey = `${spaceId}:${member.user_id}`;
      const lastUpdate = this.recentUpdates.get(updateKey);
      
      if (lastUpdate && (now - lastUpdate) < this.UPDATE_PROTECTION_TIME) {
        console.log(`[SpaceCache] Protecting recently updated member ${member.user_id} from cache overwrite`);
        return false; // Don't overwrite recently updated member
      }
      return true;
    });
    
    // Get existing cached members to preserve recently updated ones
    const existingCached = this.spaceMembersCache.get(spaceId);
    let finalMembers = filteredMembers;
    
    if (existingCached) {
      // Add back any recently updated members that were filtered out
      const protectedMembers = existingCached.data.filter(existingMember => {
        const updateKey = `${spaceId}:${existingMember.user_id}`;
        const lastUpdate = this.recentUpdates.get(updateKey);
        return lastUpdate && (now - lastUpdate) < this.UPDATE_PROTECTION_TIME;
      });
      
      // Merge protected members with new members
      const memberMap = new Map(filteredMembers.map(m => [m.user_id, m]));
      protectedMembers.forEach(protectedMember => {
        memberMap.set(protectedMember.user_id, protectedMember);
      });
      
      finalMembers = Array.from(memberMap.values());
    }
    
    this.spaceMembersCache.set(spaceId, {
      data: finalMembers,
      lastFetched: now
    });
    
    // Also update the individual member cache
    if (!this.spaceMembers.has(spaceId)) {
      this.spaceMembers.set(spaceId, new Map());
    }
    const memberMap = this.spaceMembers.get(spaceId)!;
    memberMap.clear();
    finalMembers.forEach(member => {
      memberMap.set(member.user_id, member);
      this.addUserToSpace(member.user_id, spaceId);
    });
    
    // Clean up old update timestamps
    this.cleanupOldUpdates(now);
  }

  private recentUpdates: Map<string, number> = new Map(); // Track recent updates
  private UPDATE_PROTECTION_TIME = 5000; // 5 seconds protection

  public updateCachedSpaceMember(spaceId: string, updatedMember: SpaceMember): void {
    // Update individual member cache
    this.setSpaceMember(updatedMember);
    
    // Update cached members list if it exists
    const cached = this.spaceMembersCache.get(spaceId);
    if (cached) {
      const memberIndex = cached.data.findIndex(m => m.user_id === updatedMember.user_id);
      if (memberIndex !== -1) {
        cached.data[memberIndex] = updatedMember;
      }
    }
    
    // Mark this member as recently updated
    const updateKey = `${spaceId}:${updatedMember.user_id}`;
    this.recentUpdates.set(updateKey, Date.now());
  }

  public removeSpaceMember(spaceId: string, userId: string): void {
    this.spaceMembers.get(spaceId)?.delete(userId);
    this.removeUserFromSpace(userId, spaceId);
    
    // Update cached members list if it exists
    const cached = this.spaceMembersCache.get(spaceId);
    if (cached) {
      cached.data = cached.data.filter(m => m.user_id !== userId);
    }
  }

  // Space Roles methods
  public setSpaceRole(spaceId: string, role: SpaceRole): void {
    if (!this.spaceRoles.has(spaceId)) {
      this.spaceRoles.set(spaceId, new Map());
    }
    this.spaceRoles.get(spaceId)!.set(role.role_id, role);
  }

  public getSpaceRole(spaceId: string, roleId: string): SpaceRole | undefined {
    return this.spaceRoles.get(spaceId)?.get(roleId);
  }

  public getSpaceRoles(spaceId: string): SpaceRole[] {
    const roles = this.spaceRoles.get(spaceId);
    return roles ? Array.from(roles.values()) : [];
  }

  public getCachedSpaceRoles(spaceId: string): SpaceRole[] | null {
    const cached = this.spaceRolesCache.get(spaceId);
    if (cached && Date.now() - cached.lastFetched < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  public setCachedSpaceRoles(spaceId: string, roles: SpaceRole[]): void {
    this.spaceRolesCache.set(spaceId, {
      data: roles,
      lastFetched: Date.now()
    });
    
    // Also update the individual role cache
    if (!this.spaceRoles.has(spaceId)) {
      this.spaceRoles.set(spaceId, new Map());
    }
    const roleMap = this.spaceRoles.get(spaceId)!;
    roleMap.clear();
    roles.forEach(role => {
      roleMap.set(role.role_id, role);
    });
  }

  public deleteSpace(spaceId: string): void {
    this.spaces.delete(spaceId);
    this.spaceMembers.delete(spaceId);
    
    // Remove from all user space mappings
    for (const [userId, spaceIds] of this.userSpaces.entries()) {
      this.userSpaces.set(userId, spaceIds.filter(id => id !== spaceId));
    }
  }

  public onSpaceUpdate(callback: (spaceId: string, space: Space) => void): void {
    this.spaceUpdateCallbacks.push(callback);
  }

  private notifySpaceUpdate(spaceId: string, space: Space): void {
    this.spaceUpdateCallbacks.forEach(callback => {
      try {
        callback(spaceId, space);
      } catch (error) {
        console.error('[SpaceCache] Error in space update callback:', error);
      }
    });
  }

  private cleanupOldUpdates(now: number): void {
    for (const [key, timestamp] of this.recentUpdates.entries()) {
      if (now - timestamp >= this.UPDATE_PROTECTION_TIME) {
        this.recentUpdates.delete(key);
      }
    }
  }

  public clear(): void {
    this.spaces.clear();
    this.spaceMembers.clear();
    this.spaceMembersCache.clear();
    this.spaceRoles.clear();
    this.spaceRolesCache.clear();
    this.userSpaces.clear();
    this.recentUpdates.clear();
  }
}