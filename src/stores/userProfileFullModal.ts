import { createStore } from 'solid-js/store';
import type { ProfileRole } from './userProfilePopover';

export type UserProfileFullSubject = {
  userId: string;
  displayName: string;
  username: string;
  discriminator: number;
  /** Federation: the user's home instance, shown after the tag when it isn't this one. */
  homeDomain?: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  aboutMe?: string;
  /** Shown under the name. */
  pronouns?: string;
  /** "MM-DD" (no year); present only when the person opted in to birthday announcements. */
  birthday?: string;
  /** Whether today is their birthday - drives the 🎂 next to the name. */
  birthdayToday?: boolean;
  /** Assignable roles (never @everyone), highest position first. */
  spaceRoles?: ProfileRole[];
  /** The member's highest hoisted role colour, or undefined if they have none. */
  nameColor?: string;
  joinedAtLabel?: string;
  publicFlags?: number;
  bot?: boolean;
};

type State = {
  open: boolean;
  subject: UserProfileFullSubject | null;
  currentUserId: string | undefined;
  onMessageUser: ((userId: string) => void) | undefined;
};

export const [userProfileFullModal, setUserProfileFullModal] = createStore<State>({
  open: false,
  subject: null,
  currentUserId: undefined,
  onMessageUser: undefined,
});

export function openUserProfileFullModal(
  subject: UserProfileFullSubject,
  opts?: { currentUserId?: string; onMessageUser?: (userId: string) => void }
): void {
  setUserProfileFullModal({
    open: true,
    subject,
    currentUserId: opts?.currentUserId,
    onMessageUser: opts?.onMessageUser,
  });
}

export function closeUserProfileFullModal(): void {
  setUserProfileFullModal({ open: false, subject: null, onMessageUser: undefined });
}
