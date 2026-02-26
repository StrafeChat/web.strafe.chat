import { api } from './client';
import type { User } from '../types/api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Pick<User, 'id' | 'username' | 'discriminator' | 'display_name'>;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  date_of_birth: string; // RFC3339 e.g. 1999-10-13T00:00:00.000Z
  discriminator?: number;
}

export interface RegisterResponse {
  id: string;
  email: string;
  username: string;
  discriminator: number;
  display_name: string;
  created_at: string;
}

export function login(input: LoginInput) {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    json: input,
  });
}

export function register(input: RegisterInput) {
  return api<RegisterResponse>('/auth/register', {
    method: 'POST',
    json: input,
  });
}
