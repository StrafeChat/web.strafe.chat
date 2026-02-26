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
  } catch {}
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
    } catch {}
  },
};
