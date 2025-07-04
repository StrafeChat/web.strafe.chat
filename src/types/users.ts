export interface UserType {
  id: string;
  discriminator: string;
  username: string;
  display_name: string;
  avatar: string | null;
  banner: string | null;
  bio?: string;
  about_me?: string;
  bot: boolean;
  system: boolean;
  flags: number;
  presence: any;
  created_at: string;
  updated_at: string;
}
