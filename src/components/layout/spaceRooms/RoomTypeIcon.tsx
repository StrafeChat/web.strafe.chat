import type { JSX } from 'solid-js';
import type { SpaceRoom } from '../../../api/spaces';
import { t } from '../../../i18n';

const ROOM_TYPE_VOICE = 4;

export const ChevronDownIcon = (props: { class?: string }) => (
  <svg class={props.class ?? 'size-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const HashIcon = () => (
  <svg class="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);

const SpeakerIcon = () => (
  <svg class="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

/** Hash, hash-with-lock (E2EE) or speaker, by room type. */
export function roomTypeIcon(room: SpaceRoom): JSX.Element {
  if (room.type === ROOM_TYPE_VOICE) return <SpeakerIcon />;
  if (room.e2ee_enabled) {
    // Hash with a small brand-colored lock badge: end-to-end encrypted text room.
    return (
      <span class="relative flex size-4 shrink-0 items-center justify-center" title={t('room.e2eeBadge')}>
        <HashIcon />
        <i
          class="fa-solid fa-lock absolute -bottom-1 -right-1.5 text-[8px] leading-none text-primary"
          aria-hidden="true"
        />
      </span>
    );
  }
  return <HashIcon />;
}
