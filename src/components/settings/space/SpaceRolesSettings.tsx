import { Component, createSignal, For, onMount } from "solid-js";
import { Space } from "../../../lib/cache/SpaceCache";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useCache } from "../../../lib/providers/cache/CacheProvider";
import Crown from "../../shared/icons/Crown";
import Plus from "../../shared/icons/Plus";
import Trash from "../../shared/icons/Trash";
import ColorPicker from "../../shared/ColorPicker";
import ToggleSwitch from "../../shared/ToggleSwitch";
import { apiRequest } from "../../../lib/api";
import { BASE_URL } from "../../../constants";

interface SpaceRolesSettingsProps {
  space: Space;
}

interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  mentionable: boolean;
  hoist: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

const SpaceRolesSettings: Component<SpaceRolesSettingsProps> = (props) => {
  const { isMobile, user } = useAuth();
  const cache = useCache();
  const [selectedRole, setSelectedRole] = createSignal<Role | null>(null);
  const [showCreateRole, setShowCreateRole] = createSignal(false);
  const [newRoleName, setNewRoleName] = createSignal("");
  const [newRoleColor, setNewRoleColor] = createSignal("#99aab5");

  const [roles, setRoles] = createSignal<Role[]>([]);
  const [availablePermissions, setAvailablePermissions] = createSignal<Permission[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [editedRole, setEditedRole] = createSignal<Role | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
  const [, setRenderTrigger] = createSignal(0);
  const [activeTab, setActiveTab] = createSignal<'display' | 'permissions'>('display');
  const [permissionSearch, setPermissionSearch] = createSignal('');

  const isOwner = () => props.space.owner_id === user()?.id;
  const canManageRoles = () => isOwner(); // TODO: Add role-based permissions

  // Load roles and permissions on mount
  onMount(async () => {
    console.log('SpaceRolesSettings mounted, starting to load data');
    
    // Set a timeout to ensure loading state clears even if API calls hang
     const timeoutId = setTimeout(() => {
       console.log('Timeout reached, clearing loading state');
       setLoading(false);
       setRenderTrigger(prev => prev + 1); // Force re-render
       setError('Failed to load data: Request timeout');
     }, 10000); // 10 second timeout
    
    try {
      await Promise.race([
        Promise.all([
          loadRoles(),
          loadAvailablePermissions()
        ]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 8000)
        )
      ]);
      console.log('All data loaded successfully');
      clearTimeout(timeoutId);
    } catch (err) {
      console.error('Error during data loading:', err);
      clearTimeout(timeoutId);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
       console.log('Setting loading to false');
       setLoading(false);
       setRenderTrigger(prev => prev + 1); // Force re-render
       console.log('Loading state after setting:', loading());
     }
  });

  const loadRoles = async () => {
    try {
      const spaceId = props.space.id.toString();
      console.log('Loading roles for space:', spaceId);
      
      // Check cache first
      const cachedRoles = cache.getCachedSpaceRoles(spaceId);
      if (cachedRoles) {
        console.log('Using cached roles:', cachedRoles);
        // Convert SpaceRole format to Role format for the UI
        const convertedRoles = cachedRoles.map((role: any) => ({
          id: role.role_id,
          name: role.name,
          color: role.color || '#99aab5',
          permissions: role.permissions || [],
          hoist: role.hoist || false,
          mentionable: role.mentionable || false,
          position: role.position || 0
        }));
        setRoles(convertedRoles.map(role => ({
          ...role,
          member_count: 0, // Default value since it's not in cached data
          created_at: new Date().toISOString(), // Default to current time
          updated_at: new Date().toISOString() // Default to current time
        })));
        return;
      }
      
      // Fetch from API if not cached
      console.log('Fetching roles from API');
      const rolesData = await apiRequest(`${BASE_URL}/spaces/${props.space.id}/roles`, {
        method: 'GET'
      }) as { roles: any[] };
      
      console.log('Roles data received:', rolesData);
      
      // Convert backend role format to frontend format
      const convertedRoles = rolesData.roles.map((role: any) => ({
        ...role,
        permissions: Object.keys(role.permissions || {})
      }));
      
      console.log('Converted roles:', convertedRoles);
      setRoles(convertedRoles);
      
      // Cache the roles in SpaceRole format
      const spaceRoles = rolesData.roles.map((role: any) => ({
        role_id: role.id,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: Object.keys(role.permissions || {}),
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position
      }));
      cache.setCachedSpaceRoles(spaceId, spaceRoles);
    } catch (err) {
      console.error('Error loading roles:', err);
      setError('Failed to load roles');
    }
  };

  const loadAvailablePermissions = async () => {
    try {
      console.log('Loading available permissions');
      const permissionsData = await apiRequest(`${BASE_URL}/permissions`, {
        method: 'GET'
      }) as Permission[];
      
      console.log('Permissions data received:', permissionsData);
      setAvailablePermissions(permissionsData);
    } catch (err) {
      console.error('Error loading permissions:', err);
      setError('Failed to load permissions');
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName().trim()) return;
    
    try {
      const response = await apiRequest(`${BASE_URL}/spaces/${props.space.id}/roles`, {
        method: 'POST',
        body: {
          name: newRoleName(),
          color: newRoleColor(),
          permissions: {
            "VIEW_CHANNELS": true,
            "SEND_MESSAGES": true,
            "READ_MESSAGE_HISTORY": true
          },
          mentionable: false,
          hoist: false
        }
      }) as { role: any };
      
      // Convert backend role format to frontend format
      const convertedRole = {
        ...response.role,
        permissions: Object.keys(response.role.permissions || {})
      };
      
      const updatedRoles = [...roles(), convertedRole];
      setRoles(updatedRoles);
      
      // Update cache
      const spaceId = props.space.id.toString();
      const spaceRoles = updatedRoles.map((role: any) => ({
        role_id: role.id,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: role.permissions || [],
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position
      }));
      cache.setCachedSpaceRoles(spaceId, spaceRoles);
      
      setNewRoleName("");
      setNewRoleColor("#99aab5");
      setShowCreateRole(false);
      setSelectedRole(convertedRole);
    } catch (err) {
      console.error('Error creating role:', err);
      setError('Failed to create role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (roleId === "@everyone") return; // Can't delete @everyone
    
    try {
      await apiRequest(`${BASE_URL}/spaces/${props.space.id}/roles/${roleId}`, {
        method: 'DELETE'
      });
      
      const updatedRoles = roles().filter(r => r.id !== roleId);
      setRoles(updatedRoles);
      
      // Update cache
      const spaceId = props.space.id.toString();
      const spaceRoles = updatedRoles.map((role: any) => ({
        role_id: role.id,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: role.permissions || [],
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position
      }));
      cache.setCachedSpaceRoles(spaceId, spaceRoles);
      
      if (selectedRole()?.id === roleId) {
        setSelectedRole(null);
      }
    } catch (err) {
      console.error('Error deleting role:', err);
      setError('Failed to delete role');
    }
  };

  const updateRoleProperty = (property: keyof Role, value: any) => {
    const role = editedRole();
    if (!role) return;
    
    const updatedRole = { ...role, [property]: value };
    setEditedRole(updatedRole);
    setHasUnsavedChanges(true);
  };

  const saveRoleChanges = async () => {
    const role = editedRole();
    if (!role || !hasUnsavedChanges()) return;
    
    try {
      // Convert permissions array to object format for backend
      const permissionsObject: Record<string, boolean> = {};
      role.permissions.forEach(perm => {
        permissionsObject[perm] = true;
      });

      // For @everyone role, only send permissions to avoid backend validation errors
      const updateData = role.id === "@everyone" 
        ? { permissions: permissionsObject }
        : {
            name: role.name,
            color: role.color,
            permissions: permissionsObject,
            hoist: role.hoist,
            mentionable: role.mentionable
          };

      const response = await apiRequest(`${BASE_URL}/spaces/${props.space.id}/roles/${role.id}`, {
        method: 'PATCH',
        body: updateData
      }) as any;
      
      // Convert backend role format to frontend format
      const convertedRole = {
        ...response,
        permissions: Object.keys(response.permissions || {})
      };
      
      const updatedRoles = roles().map(r => r.id === role.id ? convertedRole : r);
      setSelectedRole(convertedRole);
      setEditedRole(convertedRole);
      setRoles(updatedRoles);
      
      // Update cache
      const spaceId = props.space.id.toString();
      const spaceRoles = updatedRoles.map((role: any) => ({
        role_id: role.id,
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: role.permissions || [],
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position
      }));
      cache.setCachedSpaceRoles(spaceId, spaceRoles);
      
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update role');
    }
  };

  const togglePermission = (permission: string) => {
    const role = editedRole();
    if (!role) return;
    
    const hasPermission = role.permissions.includes(permission);
    const newPermissions = hasPermission
      ? role.permissions.filter(p => p !== permission)
      : [...role.permissions, permission];
    
    updateRoleProperty('permissions', newPermissions);
  };

  const selectRole = (role: Role) => {
    setSelectedRole(role);
    setEditedRole({ ...role });
    setHasUnsavedChanges(false);
    
    // If selecting @everyone role, switch to permissions tab since display tab is not available
    if (role.id === "@everyone" && activeTab() === 'display') {
      setActiveTab('permissions');
    }
  };

  const cancelChanges = () => {
    const role = selectedRole();
    if (role) {
      setEditedRole({ ...role });
      setHasUnsavedChanges(false);
    }
  };

  // Group permissions by category with search filtering
  const groupedPermissions = () => {
    const searchTerm = permissionSearch().toLowerCase();
    const filteredPermissions = availablePermissions().filter(perm => 
      perm.name.toLowerCase().includes(searchTerm) || 
      perm.description.toLowerCase().includes(searchTerm)
    );
    
    const groups: Record<string, Permission[]> = {};
    filteredPermissions.forEach(perm => {
      if (!groups[perm.category]) {
        groups[perm.category] = [];
      }
      groups[perm.category].push(perm);
    });
    return groups;
  };

  // // Force reactivity check with render trigger
  // const isLoading = () => {
  //   renderTrigger(); // Access render trigger to ensure reactivity
  //   const loadingState = loading();
  //   console.log('Current loading state in render:', loadingState, 'trigger:', renderTrigger());
  //   return loadingState;
  // };
  
  return (
    <div class={`mb-8 ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-purple-500/10 rounded-lg">
          <Crown />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            Roles
          </h2>
          <p class="text-text-secondary text-xs">
            Manage roles and permissions for your space members
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error() && (
        <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p class="text-red-500 text-sm">{error()}</p>
          <button
            onClick={() => {
              setError(null);
              loadRoles();
              loadAvailablePermissions();
            }}
            class="mt-2 text-xs text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div class="flex gap-6">
        {/* Roles List */}
        <div class="w-1/3 bg-background1 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-text-primary">Roles</h3>
            {canManageRoles() && (
              <button
                onClick={() => setShowCreateRole(true)}
                class="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors"
                title="Create Role"
              >
                <Plus />
              </button>
            )}
          </div>
          
          {/* Create Role Form */}
          {showCreateRole() && (
            <div class="mb-4 p-3 bg-background2 rounded-lg border border-border">
              <div class="space-y-3">
                <input
                  type="text"
                  value={newRoleName()}
                  onInput={(e) => setNewRoleName(e.currentTarget.value)}
                  placeholder="Role name"
                  class="w-full p-2 bg-background1 border border-border rounded text-text-primary"
                />
                <div class="flex flex-col gap-2">
                  <span class="text-sm text-text-secondary">Role color</span>
                  <ColorPicker
                    value={newRoleColor()}
                    onChange={(color) => setNewRoleColor(color)}
                    class="w-full"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    onClick={handleCreateRole}
                    disabled={!newRoleName().trim()}
                    class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateRole(false)}
                    class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Roles List */}
          <div class="space-y-2">
            <For each={roles().sort((a, b) => b.position - a.position)}>
              {(role) => (
                <div
                  class={`p-3 rounded-lg transition-colors ${
                    selectedRole()?.id === role.id
                      ? "bg-primary/20 border border-primary"
                      : role.id === "@everyone" 
                        ? "bg-background2 hover:bg-background2/80 cursor-pointer"
                        : "bg-background2/50 cursor-not-allowed opacity-60"
                  }`}
                  onClick={() => role.id === "@everyone" ? selectRole(role) : null}
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-4 h-4 rounded-full"
                        style={{ "background-color": role.color }}
                      />
                      <div>
                        <div class="text-sm font-medium text-text-primary">{role.name}</div>
                        <div class="text-xs text-text-secondary">{role.member_count} members</div>
                      </div>
                    </div>
                    {canManageRoles() && role.id !== "@everyone" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role.id);
                        }}
                        class="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete Role"
                      >
                        <Trash />
                      </button>
                    )}
                    {role.id !== "@everyone" && (
                      <div class="text-xs text-yellow-500 font-medium">
                        Read-only
                      </div>
                    )}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Role Settings */}
        <div class="flex-1 bg-background1 rounded-lg p-6">
          {selectedRole() ? (
            <div>
              <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                  <div
                    class="w-6 h-6 rounded-full"
                    style={{ "background-color": editedRole()?.color || selectedRole()!.color }}
                  />
                  <h3 class="text-lg font-semibold text-text-primary">{editedRole()?.name || selectedRole()!.name}</h3>
                  {selectedRole()!.id === "@everyone" && (
                    <span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                      Editable
                    </span>
                  )}
                </div>
                {canManageRoles() && selectedRole()!.id === "@everyone" && (
                  <div class="flex gap-2">
                    {hasUnsavedChanges() && (
                      <button
                        onClick={cancelChanges}
                        class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={saveRoleChanges}
                      disabled={!hasUnsavedChanges()}
                      class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>

              {/* Tab Navigation - Only show permissions tab for @everyone */}
              {selectedRole()!.id === "@everyone" && (
                <div class="flex border-b border-border mb-6">
                  <button
                    onClick={() => setActiveTab('permissions')}
                    class="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary"
                  >
                    Permissions
                  </button>
                </div>
              )}
              
              {/* Show message for non-@everyone roles */}
              {selectedRole()!.id !== "@everyone" && (
                <div class="text-center py-8 bg-background2 rounded-lg">
                  <div class="text-text-secondary mb-2">
                    <Crown class="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p class="text-sm">Only @everyone role permissions can be edited</p>
                    <p class="text-xs mt-1">Other roles are read-only for security</p>
                  </div>
                </div>
              )}

              {/* Tab Content - Only show permissions for @everyone */}
              {selectedRole()!.id === "@everyone" && (
                <div class="space-y-6">
                  <div class="bg-background2 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-4">
                      <h4 class="text-md font-semibold text-text-primary">@everyone Role Permissions</h4>
                      <div class="flex-1 max-w-xs ml-4">
                        <input
                          type="text"
                          value={permissionSearch()}
                          onInput={(e) => setPermissionSearch(e.currentTarget.value)}
                          placeholder="Search permissions..."
                          class="w-full p-2 bg-background1 border border-border rounded-lg text-text-primary text-sm"
                        />
                      </div>
                    </div>
                    <div class="space-y-4">
                      <For each={Object.entries(groupedPermissions())}>
                        {([category, permissions]) => (
                          <div>
                            <h5 class="text-sm font-medium text-text-primary mb-3 capitalize">
                              {category} Permissions
                            </h5>
                            <div class="space-y-3">
                              <For each={permissions}>
                                {(permission) => {                                 
                                  return (
                                    <div class="flex items-center justify-between p-3 bg-background1 rounded-lg">
                                      <div class="flex-1">
                                        <div class="text-sm font-medium text-text-primary">{permission.name}</div>
                                        <div class="text-xs text-text-secondary">{permission.description}</div>
                                      </div>
                                      <ToggleSwitch
                                        checked={editedRole()?.permissions?.includes(permission.id) || false}
                                        onChange={() => togglePermission(permission.id)}
                                        disabled={!canManageRoles()}
                                      />
                                    </div>
                                  );
                                }}
                              </For>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div class="text-center py-12">
              <Crown class="w-12 h-12 text-text-secondary mx-auto mb-4" />
              <p class="text-text-secondary">Select a role to edit its settings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpaceRolesSettings;