import { api } from './client';
import type { User } from '../types/api';

export interface MeResponse {
  id: string;
  email: string;
  username: string;
  discriminator: string; // "0001" format
  display_name: string;
  bio?: string;
  about_me?: string;
  avatar?: string;
  banner?: string;
  accent_color?: string;
  presence?: unknown;
}

export function getMe() {
  return api<MeResponse>('/users/@me');
}

export function toAuthUser(me: MeResponse): Pick<User, 'id' | 'username' | 'discriminator' | 'display_name'> {
  const d = parseInt(me.discriminator, 10);
  return {
    id: me.id,
    username: me.username,
    discriminator: isNaN(d) ? 0 : d,
    display_name: me.display_name,
  };
}
