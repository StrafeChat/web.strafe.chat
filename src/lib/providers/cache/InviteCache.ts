import { InviteInfo } from "../../../types/api";

export class InviteCache {
  private invites: Map<string, InviteInfo> = new Map();
  private fetchPromises: Map<string, Promise<InviteInfo>> = new Map();
  private lastFetchTimes: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get invite info from cache or fetch if not cached/expired
   */
  async getInviteInfo(code: string, fetchFn: () => Promise<InviteInfo>): Promise<InviteInfo> {
    const cached = this.invites.get(code);
    const lastFetch = this.lastFetchTimes.get(code);
    const now = Date.now();

    // Return cached data if it exists and is not expired
    if (cached && lastFetch && (now - lastFetch) < this.CACHE_DURATION) {
      return cached;
    }

    // If there's already a fetch in progress, return that promise
    const existingPromise = this.fetchPromises.get(code);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new fetch promise
    const fetchPromise = fetchFn()
      .then((inviteInfo) => {
        this.invites.set(code, inviteInfo);
        this.lastFetchTimes.set(code, now);
        this.fetchPromises.delete(code);
        return inviteInfo;
      })
      .catch((error) => {
        this.fetchPromises.delete(code);
        throw error;
      });

    this.fetchPromises.set(code, fetchPromise);
    return fetchPromise;
  }

  /**
   * Get cached invite info without fetching
   */
  getCachedInviteInfo(code: string): InviteInfo | undefined {
    const cached = this.invites.get(code);
    const lastFetch = this.lastFetchTimes.get(code);
    const now = Date.now();

    if (cached && lastFetch && (now - lastFetch) < this.CACHE_DURATION) {
      return cached;
    }

    return undefined;
  }

  /**
   * Manually set invite info in cache
   */
  setInviteInfo(code: string, inviteInfo: InviteInfo): void {
    this.invites.set(code, inviteInfo);
    this.lastFetchTimes.set(code, Date.now());
  }

  /**
   * Remove invite from cache
   */
  removeInviteInfo(code: string): void {
    this.invites.delete(code);
    this.lastFetchTimes.delete(code);
    this.fetchPromises.delete(code);
  }

  /**
   * Clear all cached invites
   */
  clearCache(): void {
    this.invites.clear();
    this.lastFetchTimes.clear();
    this.fetchPromises.clear();
  }

  /**
   * Get all cached invite codes
   */
  getCachedCodes(): string[] {
    return Array.from(this.invites.keys());
  }

  /**
   * Check if invite is cached and not expired
   */
  isCached(code: string): boolean {
    const lastFetch = this.lastFetchTimes.get(code);
    const now = Date.now();
    return this.invites.has(code) && lastFetch !== undefined && (now - lastFetch) < this.CACHE_DURATION;
  }

  // Simple interface methods for CacheProvider
  getInvite(code: string): InviteInfo | undefined {
    return this.getCachedInviteInfo(code);
  }

  setInvite(invite: InviteInfo): void {
    if (invite.code) {
      this.setInviteInfo(invite.code, invite);
    }
  }

  deleteInvite(code: string): void {
    this.removeInviteInfo(code);
  }

  clearInvites(): void {
    this.clearCache();
  }
}