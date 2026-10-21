import { createSignal } from 'solid-js';

/**
 * Which member's nickname the Change Nickname dialog (components/NicknameDialog, mounted once
 * in the app shell) is editing. A store rather than local state so every entry point - the
 * member and author context menus, the profile popover's pencil, Space Settings > Members -
 * opens the one dialog with nothing but ids.
 */
export interface NicknameDialogRequest {
  spaceId: string;
  userId: string;
}

const [request, setRequest] = createSignal<NicknameDialogRequest | null>(null);

/** The open request, or null when the dialog is closed (a signal getter). */
export function nicknameDialogRequest(): NicknameDialogRequest | null {
  return request();
}

export function openNicknameDialog(req: NicknameDialogRequest): void {
  setRequest({ spaceId: req.spaceId, userId: req.userId });
}

export function closeNicknameDialog(): void {
  setRequest(null);
}
