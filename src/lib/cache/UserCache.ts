export interface CachedUser {
  ID: string;
  Username: string;
  Discriminator: number | string;
  DisplayName?: string;
  Avatar?: string;
  Banner?: string;
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
      this.users.set(id, user as CachedUser);
    }
  }

  public getUsers(): Map<string, CachedUser> {
    return this.users;
  }

  public getUser(id: string): CachedUser | undefined {
    return this.users.get(id);
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
