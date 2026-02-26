import type { Component } from 'solid-js';
import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getNotesRoom } from '../api/rooms';
import { rooms, setRooms, isNotesRoom } from '../stores/rooms';
import { setUserPresence } from '../stores/presence';
import { auth } from '../stores/auth';

/** Notes room from store (loadRooms includes it once it exists). */
function findNotesRoom(): (typeof rooms.rooms)[number] | undefined {
  const uid = auth.user?.id;
  if (!uid) return undefined;
  return rooms.rooms.find((r) => isNotesRoom(r, uid));
}

const NotesIcon = () => (
  <svg class="size-24 text-muted-foreground/40 mx-auto mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const NotesPage: Component = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Redirect when notes room appears in store (e.g. from loadRooms)
  createEffect(() => {
    const room = findNotesRoom();
    if (room) {
      setLoading(false);
      navigate(`/rooms/${room.id}`, { replace: true });
    }
  });

  onMount(() => {
    const cached = findNotesRoom();
    if (cached) {
      setLoading(false);
      navigate(`/rooms/${cached.id}`, { replace: true });
      return;
    }
    setError(null);
    setLoading(true);
    getNotesRoom()
      .then((room) => {
        // Seed presence for self (notes room has only current user as participant)
        for (const p of room.participants ?? []) {
          if (p.presence?.status) {
            setUserPresence(p.id, p.presence);
          }
        }
        // Ensure room is in store
        const existing = rooms.rooms.find((r) => r.id === room.id);
        if (!existing) {
          setRooms('rooms', (list) => [...list, room]);
        }
        navigate(`/rooms/${room.id}`, { replace: true });
      })
      .catch((err) => {
        console.error('Failed to get notes room:', err);
        setError(err?.message ?? 'Failed to load notes');
      })
      .finally(() => setLoading(false));
  });

  return (
    <div class="flex-1 flex flex-col">
      <div class="h-12 flex items-center gap-2 px-4 border-b border-border shrink-0">
        <i class="fa-solid fa-note-sticky text-muted-foreground shrink-0" />
        <h1 class="text-base font-semibold text-foreground">Notes</h1>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Show when={loading()} fallback={
          <Show when={error()}>
            <p class="text-destructive">{error()}</p>
          </Show>
        }>
          <NotesIcon />
          <p class="text-muted-foreground mt-4">Loading your notes...</p>
          <span class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent mt-4" />
        </Show>
      </div>
    </div>
  );
};

export default NotesPage;
