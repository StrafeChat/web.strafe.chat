/**
 * Following a room or message link inside the app (the web's half of lib/roomLinks.ts): open
 * the room, then jump to the message with the same machinery as a reply or a search hit -
 * scrolled to and flashed when it is loaded, a window loaded around it when not. A link to a
 * room that does not exist, or that this account may not see, says so instead of opening a
 * blank page.
 *
 * Every link the app renders for people to follow (messages, embeds, bios, preview cards) is
 * an `<a target="_blank">`; one listener on the window takes the ones that point at a room
 * here. In a browser only a plain click is taken - Ctrl/Cmd/Shift-click and the middle button
 * keep opening a new tab. The desktop app has no tabs, and its shells would hand any link to
 * the system browser, so there every click on one is taken, the middle button too.
 */
import { isDesktop } from '../desktop/env';
import { confirmDialog } from '../stores/confirmDialog';
import { jumpToMessage, loadMessages, messages } from '../stores/messages';
import { requestNavigate } from './notifications';
import { resolveRoomLink, roomLinkFromUrl, roomLinkPath, type RoomLink, type RoomLinkTarget } from './roomLinks';
import { t } from '../i18n';

/** The path a resolved link opens. */
export function roomTargetPath(target: RoomLinkTarget): string {
  if (target.notes) return '/notes';
  return roomLinkPath(target.roomId, target.spaceId);
}

function notice(title: string, body: string): void {
  void confirmDialog({
    title,
    body,
    acknowledgeOnly: true,
    confirmLabel: t('common.close'),
    icon: 'fa-solid fa-link-slash',
  });
}

/**
 * Open a room link in the app. `go` routes (the window-level router request by default; the
 * message-link route passes a replacing navigate). Resolves true when the room opened.
 */
export async function openRoomLink(link: RoomLink, go: (path: string) => void = requestNavigate): Promise<boolean> {
  const target = await resolveRoomLink(link);
  if (!target) {
    notice(t('messages.roomLink.unavailableTitle'), t('messages.roomLink.unavailableBody'));
    return false;
  }
  const { roomId, messageId } = target;
  if (!messageId) {
    go(roomTargetPath(target));
    return true;
  }
  // Started before the route changes: it marks the room as jumping straight away, so the page
  // opening it defers its own "load the newest page" to this load around the message.
  const jumping = jumpToMessage(roomId, messageId);
  go(roomTargetPath(target));
  try {
    await jumping;
  } catch {
    // The window around it could not be loaded; show the room as it would open anyway.
    if (messages.byRoom[roomId] === undefined) void loadMessages(roomId);
    notice(t('messages.roomLink.messageMissingTitle'), t('messages.roomLink.messageMissingBody'));
    return true;
  }
  if (!messages.byRoom[roomId]?.some((m) => m.id === messageId)) {
    // Deleted (the list lands where it was), or never in this room.
    notice(t('messages.roomLink.messageMissingTitle'), t('messages.roomLink.messageMissingBody'));
  }
  return true;
}

function anchorOf(e: MouseEvent): HTMLAnchorElement | null {
  for (const el of e.composedPath()) {
    if (el instanceof HTMLAnchorElement) return el;
  }
  return null;
}

/**
 * Take clicks on links to rooms here and open them in the app. Installed once by the app
 * shell; returns its removal.
 */
export function installRoomLinkInterceptor(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    const desktop = isDesktop();
    if (e.type === 'auxclick') {
      if (!desktop || e.button !== 1) return;
    } else if (e.button !== 0) {
      return;
    }
    if (!desktop && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
    const a = anchorOf(e);
    // Only links meant to leave the page: the app's own navigation (<A> in the room lists)
    // routes itself.
    if (!a || a.target !== '_blank' || a.hasAttribute('download')) return;
    const link = roomLinkFromUrl(a.href);
    if (!link) return;
    e.preventDefault();
    void openRoomLink(link);
  };
  window.addEventListener('click', onClick, true);
  window.addEventListener('auxclick', onClick, true);
  return () => {
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('auxclick', onClick, true);
  };
}
