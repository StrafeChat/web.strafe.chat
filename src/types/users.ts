export interface UserType {
  id: string;
  discriminator: string;
  username: string;
  display_name: string;
  avatar: string | null;
  banner: string | null;
  bot: boolean;
  system: boolean;
  flags: number;
  presence: any;
  created_at: string;
  updated_at: string;
}
