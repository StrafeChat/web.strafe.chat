import { useAuth } from "../providers/auth/AuthProvider";
import { useCache } from "../providers/cache/CacheProvider";

/**
 * Global hook for checking user permissions in spaces
 * @returns Function to check if current user has a specific permission in a space
 */
export const usePermissions = () => {
  const { user } = useAuth();
  const cache = useCache();

  const checkPermission = (spaceId: string, permission: string): boolean => {
    const currentUser = user();
    if (!currentUser || !spaceId) return false;

    // Check if user is space owner
    const space = cache.getSpace(spaceId);
    if (space && space.owner_id === currentUser.id) {
      return true;
    }

    // Get user's roles in this space
    const member = cache.getSpaceMember(spaceId, currentUser.id);
    if (!member || !member.roles) return false;

    // Check permissions in user's roles
    for (const roleId of member.roles) {
      const role = cache.getSpaceRole(spaceId, roleId);
      if (role && role.permissions && role.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  };

  return {
    checkPermission,
  };
};