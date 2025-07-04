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