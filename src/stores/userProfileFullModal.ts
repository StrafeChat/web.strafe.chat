import { createStore } from 'solid-js/store';

export type UserProfileFullSubject = {
  userId: string;
  displayName: string;
  username: string;
  discriminator: number;
  avatar?: string;
  banner?: string;
  bio?: string;
  aboutMe?: string;
  spaceRoleNames?: string[];
  joinedAtLabel?: string;
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
