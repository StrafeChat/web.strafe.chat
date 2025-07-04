export interface CachedUser {
  ID: string;
  Username: string;
  Discriminator: number | string;
  DisplayName?: string;
  Avatar?: string;
  Banner?: string;
  Bio?: string;
  AboutMe?: string;
  Bot?: boolean;
  System?: boolean;
  Flags?: number;
  Presence?: {
    Status: string;
    CustomStatus: string;
  };
  presence?: {
    status: string;
    custom_status: string;
  };
}

export class UserCache {
  private users: Map<string, CachedUser> = new Map();
  private presenceUpdateCallbacks: ((
    userId: string,
    presence: { status: string; custom_status: string },
  ) => void)[] = [];

  public setUsers(users: { [key: string]: any }) {
    for (const [id, user] of Object.entries(users)) {
      this.setUser({ ...user, ID: id, id: id });
    }
  }

  public setUser(user: any) {
    console.log("[UserCache] Setting user in cache:", user);
    if (user && (user.ID || user.id)) {
      const userId = user.ID || user.id;
      // Ensure the user object follows the CachedUser interface format
      const cachedUser: CachedUser = {
        ID: userId,
        Username: user.Username || user.username,
        Discriminator: user.Discriminator || user.discriminator,
        DisplayName: user.DisplayName || user.display_name || user.Username || user.username,
        Avatar: user.Avatar || user.avatar,
        Banner: user.Banner || user.banner,
        Bio: user.Bio || user.bio,
        AboutMe: user.AboutMe || user.about_me,
        Bot: user.Bot || user.bot,
        System: user.System || user.system,
        Flags: user.Flags || user.flags,
        Presence: user.Presence || {
          Status: user.presence?.status || "online",
          CustomStatus: user.presence?.custom_status || ""
        },
        presence: user.presence || {
          status: user.Presence?.Status || "online",
          custom_status: user.Presence?.CustomStatus || ""
        }
      };
      this.users.set(userId, cachedUser);
      console.log("[UserCache] User added to cache:", userId);
    } else {
      console.warn("[UserCache] Attempted to add user without ID to cache", user);
    }
  }

  public getUsers(): Map<string, CachedUser> {
    return this.users;
  }

  public getUser(id: string): CachedUser | undefined {
    return this.users.get(id);
  }

  public getCurrentUserId(): string | undefined {
    // Find the current user in the cache
    for (const [id, user] of this.users.entries()) {
      if (user.System) {
        return id;
      }
    }
    return undefined;
  }

  public onPresenceUpdate(
    callback: (
      userId: string,
      presence: { status: string; custom_status: string },
    ) => void,
  ) {
    this.presenceUpdateCallbacks.push(callback);
  }

  public updateUserPresence(
    userId: string,
    status: string,
    customStatus: string,
  ) {
    console.log("[UserCache] Attempting to update presence for user:", userId);
    console.log(
      "[UserCache] Current users in cache:",
      Array.from(this.users.keys()),
    );

    const user = this.users.get(userId);
    if (user) {
      console.log("[UserCache] Found user, updating presence:", user);
      // Update both presence formats for compatibility
      user.Presence = {
        Status: status,
        CustomStatus: customStatus,
      };
      user.presence = {
        status,
        custom_status: customStatus,
      };
      this.users.set(userId, user);

      // Notify callbacks of presence update
      this.presenceUpdateCallbacks.forEach((callback) => {
        callback(userId, { status, custom_status: customStatus });
      });
    } else {
      console.warn(
        `[UserCache] Attempted to update presence for non-existent user: ${userId}`,
      );
    }
  }

  public clear() {
    this.users.clear();
  }
}
