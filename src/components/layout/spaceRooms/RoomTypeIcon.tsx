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

/**
 * Hash or speaker by room type, with a small lock badge when the room is end-to-end encrypted
 * (brand-colored) or restricted from @everyone (muted). E2EE takes the color when both apply.
 */
export function roomTypeIcon(room: SpaceRoom, opts?: { private?: boolean }): JSX.Element {
  const base = room.type === ROOM_TYPE_VOICE ? <SpeakerIcon /> : <HashIcon />;
  const e2ee = room.e2ee_enabled === true;
  const isPrivate = opts?.private === true;
  if (!e2ee && !isPrivate) return base;
  return (
    <span
      class="relative flex size-4 shrink-0 items-center justify-center"
      title={e2ee ? t('room.e2eeBadge') : t('room.privateBadge')}
    >
      {base}
      <i
        class={`fa-solid fa-lock absolute -bottom-1 -right-1.5 text-[8px] leading-none ${
          e2ee ? 'text-primary' : 'text-muted-foreground'
        }`}
        aria-hidden="true"
      />
    </span>
  );
}
