import { isDesktop } from '../desktop/env';
import { openPopupWindow } from '../desktop/native';

/**
 * An in-app page for a short side task (the OAuth consent screen a bot install opens):
 * a new tab in a browser, a small window of its own in the desktop app, where
 * window.open would have gone nowhere.
 */
export function openAppWindow(url: string, opts?: { width?: number; height?: number; title?: string }): void {
  if (isDesktop()) {
    openPopupWindow(url, opts);
    return;
  }
  window.open(url, '_blank', 'noopener');
}
