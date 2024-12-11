export interface PresencePayload {
  user_id: string;
  status?: string;
  online: boolean;
  custom_status?: string;
}

export type PresenceStatus = {
  status?: string;
  online: boolean;
  custom_status: string;
}
