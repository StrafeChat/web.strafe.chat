import { createSignal } from 'solid-js';

const KEY = 'strafe-last-visited';

function qualifies(path: string): boolean {
  if (path === '/' || path === '/friends' || path === '/notes') return true;
  return path.startsWith('/rooms/');
}

function getInitial(): string {
  try {
    const s = localStorage.getItem(KEY);
    if (s && qualifies(s)) return s;
  } catch {
    // localStorage unavailable (private mode / quota): the last-visited hint is a convenience.
  }
  return '/';
}

const [path, setPath] = createSignal(getInitial());

export const lastVisited = {
  path,
  set(pathname: string) {
    if (!qualifies(pathname)) return;
    setPath(pathname);
    try {
      localStorage.setItem(KEY, pathname);
    } catch {
      // localStorage unavailable: nothing to restore.
    }
  },
};
