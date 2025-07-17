import { Component, createSignal, For, Show, createEffect } from "solid-js";
import { useCache } from "../../lib/providers/cache/CacheProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { usePermissions } from "../../lib/hooks/usePermissions";
import { api } from "../../lib/api";
import { SpaceMember } from "../../lib/cache/SpaceCache";
import Modal from "./Modal";

interface RoleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: SpaceMember | null;
  spaceId: string;
}

const RoleManagementModal: Component<RoleManagementModalProps> = (props) => {
  const cache = useCache();
  const { user } = useAuth();
  const { checkPermission } = usePermissions();
  const [saving, setSaving] = createSignal(false);
  const [selectedRoles, setSelectedRoles] = createSignal<string[]>([]);

  // Initialize selected roles when member changes
  const initializeRoles = () => {
    if (props.member) {
      setSelectedRoles([...props.member.roles]);
    }
  };

  // Get available roles for the space
  const availableRoles = () => {
    const roles = cache.getCachedSpaceRoles(props.spaceId) || [];
    // Filter out @everyone role as it's automatically assigned
    return roles.filter(role => role.name !== "@everyone");
  };

  // Check if current user can manage roles
  const canManageRoles = () => {
    const currentSpace = cache.getSpace(props.spaceId);
    if (!currentSpace || !user()) return false;
    
    // Space owner can always manage roles
    if (currentSpace.owner_id === user()?.id) return true;
    
    // Check for MANAGE_ROLES permission using global hook
    return checkPermission(props.spaceId, "MANAGE_ROLES");
  };

  const toggleRole = (roleId: string) => {
    const current = selectedRoles();
    if (current.includes(roleId)) {
      setSelectedRoles(current.filter(id => id !== roleId));
    } else {
      setSelectedRoles([...current, roleId]);
    }
  };

  const handleSave = async () => {
    console.log("[RoleManagementModal] Save button clicked");
    console.log("[RoleManagementModal] Member:", props.member);
    console.log("[RoleManagementModal] Can manage roles:", canManageRoles());
    console.log("[RoleManagementModal] Selected roles:", selectedRoles());
    
    if (!props.member || !canManageRoles()) {
      console.log("[RoleManagementModal] Save aborted - no member or no permission");
      return;
    }
    
    setSaving(true);
    try {
      console.log("[RoleManagementModal] Making API call...");
      await api.spaces.members.updateRoles(
        props.spaceId,
        props.member.user_id,
        selectedRoles()
      );
      
      console.log("[RoleManagementModal] API call successful, updating cache...");
      // Update member roles in cache
      const updatedMember = { ...props.member, roles: selectedRoles() };
      cache.updateCachedSpaceMember(props.spaceId, updatedMember);
      
      console.log("[RoleManagementModal] Closing modal...");
      props.onClose();
    } catch (error) {
      console.error("[RoleManagementModal] Failed to update member roles:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving()) {
      props.onClose();
    }
  };

  createEffect(() => {
    if (props.isOpen && props.member) {
      setSelectedRoles([...props.member.roles]);
    }
  });

  // Remove the initializeRoles function if no longer needed

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <div class="space-y-4">
        {/* Header */}
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-text-primary">
            Manage Roles for {props.member?.user?.display_name || props.member?.user?.username}
          </h3>
        </div>

        <Show when={!canManageRoles()}>
          <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p class="text-red-400 text-sm">
              You don't have permission to manage roles in this space.
            </p>
          </div>
        </Show>

        <Show when={canManageRoles()}>
          {/* Roles List */}
          <div class="space-y-2 mb-6">
            <p class="text-sm text-text-secondary mb-3">
              Select roles to assign to this member:
            </p>
            
            <For each={availableRoles()}>
              {(role) => (
                <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface hover:bg-opacity-10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoles().includes(role.role_id)}
                    onChange={() => toggleRole(role.role_id)}
                    class="w-4 h-4 text-primary bg-background1 border-surface rounded focus:ring-primary focus:ring-2"
                    disabled={saving()}
                  />
                  <div class="flex items-center gap-2 flex-1">
                    <div 
                      class="w-3 h-3 rounded-full"
                      style={{ "background-color": role.color || "#99aab5" }}
                    />
                    <span class="text-text-primary font-medium">{role.name}</span>
                  </div>
                </label>
              )}
            </For>
            
            <Show when={availableRoles().length === 0}>
              <p class="text-text-secondary text-sm text-center py-4">
                No roles available to assign.
              </p>
            </Show>
          </div>

          {/* Actions */}
          <div class="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              class="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              disabled={saving()}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              class="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving() || availableRoles().length === 0}
            >
              {saving() ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </Show>
      </div>
    </Modal>
  );
};

export default RoleManagementModal;