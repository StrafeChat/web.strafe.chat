import { Clientuser } from "../lib/providers/auth/AuthProvider";

export type UserMeResponse = {
  client_user: {
    ID: string;
    Username: string;
    Discriminator: string;
    DisplayName?: string;
    Email: string;
    DateOfBirth?: string;
    Avatar?: string;
    Banner?: string;
    Bio?: string;
    AboutMe?: string;
    Friends?: string[];
    Presence?: {
      Status: string;
      CustomStatus: string;
    };
  };
  users?: Record<string, any>;
  relationships?: string[];
  relationship_requests?: Array<{
    ID: string;
    SenderID: string;
    RecipientID: string;
    CreatedAt: string;
  }>;
  rooms?: Record<string, any>;
};

export type LoginResponse = {
  token: string;
};

export type RegisterResponse = {
  token: string;
};

export type BulkUsersResponse = {
  users: Record<string, {
    Username: string;
    Discriminator: string;
    DisplayName?: string;
    Avatar?: string;
    Banner?: string;
    Bio?: string;
    AboutMe?: string;
    Presence?: {
      Status: string;
      CustomStatus: string;
    };
  }>;
};

export type UpdateStatusResponse = Clientuser;

export type SessionsResponse = {
  sessions: Array<{
    token: string;
    user_id: string;
    ip: string;
    user_agent: string;
    trusted: boolean;
    created_at: string;
    expires_at: string;
    current: boolean;
  }>;
};

// API Response types for invite operations
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SpaceInvite {
  id: string;
  code: string;
  creator_id: string;
  space_id: string;
  max_uses?: number;
  uses: number;
  expires_at?: string;
  created_at: string;
}

export interface InviteInfo {
  space_id: number;
  space_name: string;
  space_icon?: string;
  space_banner?: string;
  space_name_acronym?: string;
  inviter_id: string;
  inviter_username: string;
  inviter_display_name?: string;
  inviter_avatar?: string;
  member_count: number;
  expires_at?: string;
  max_uses?: number;
  uses: number;
  code: string;
}

export type SpaceInvitesListResponse = ApiResponse<SpaceInvite[]>;
export type SpaceInviteCreateResponse = ApiResponse<SpaceInvite>;
export type SpaceInviteDeleteResponse = ApiResponse<{}>;
export type InviteInfoResponse = ApiResponse<InviteInfo>;