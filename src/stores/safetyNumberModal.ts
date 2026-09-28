import { createStore } from 'solid-js/store';

export type SafetyNumberSubject = {
  userId: string;
  displayName: string;
};

type State = {
  open: boolean;
  subject: SafetyNumberSubject | null;
};

export const [safetyNumberModal, setSafetyNumberModal] = createStore<State>({
  open: false,
  subject: null,
});

export function openSafetyNumberModal(subject: SafetyNumberSubject): void {
  setSafetyNumberModal({ open: true, subject });
}

export function closeSafetyNumberModal(): void {
  setSafetyNumberModal({ open: false, subject: null });
}
