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
    Presence?: {
      Status: string;
      CustomStatus: string;
    };
  }>;
};

export type UpdateStatusResponse = Clientuser;