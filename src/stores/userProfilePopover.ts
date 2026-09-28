import { createStore } from 'solid-js/store';
import type { RoomParticipant } from '../api/rooms';
import type { SpaceRole } from '../api/spaces';
import { roleNamesForMember, spaceJoinedLabel } from '../lib/userProfilePopoverHelpers';

/** When set, popover may show role toggles for this space member (requires permission). */
export type SpaceMemberRoleEditContext = {
  spaceId: string;
  spaceOwnerId: string;
  /** Target member’s role ids (includes @everyone). */
  subjectRoleIds: string[];
  spaceRoles: SpaceRole[];
  canManageMemberRoles: boolean;
  /** Highest role position the viewer may hand out below (Infinity for the owner). Roles
   * at or above it are shown locked, matching what the server enforces. */
  viewerHighestPosition?: number;
  onMemberRolesUpdated?: () => void;
};

export type UserProfilePopoverSubject = {
  userId: string;
  displayName: string;
  username: string;
  discriminator: number;
  /** Federation: the user's home instance (shown after the tag when it isn't this one). */
  homeDomain?: string;
  avatar?: string;
  banner?: string;
  /** Short snippet; basic markdown only. Shown on this popover. */
  aboutMe?: string;
  /** Full bio (markdown + sanitized HTML); open “View full profile” to read. */
  bio?: string;
  spaceRoleNames?: string[];
  joinedAtLabel?: string;
};

const POPOVER_WIDTH = 320;
const MARGIN = 8;
const GAP = 8;
/** Used only for the first paint, before the real card has a measured height. */
const FALLBACK_HEIGHT = 360;

type AnchorRect = { top: number; bottom: number; left: number; right: number; width: number };

function toAnchorRect(r: DOMRect): AnchorRect {
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
}

/**
 * Anchor-aware placement: centering-then-clamping (the old approach) visibly disconnects
 * the popover from whatever was clicked whenever the anchor sits near a screen edge (a
 * message avatar hugging the left edge of the chat column, a member row spanning the full
 * width of a right-hand sidebar) - the clamp wins and the popover ends up floating well
 * away from the click. Instead: try centered first, but if that would clip either edge,
 * pin an edge of the popover to the matching edge of the anchor so it still reads as
 * "belonging" to what was clicked.
 */
function computeHorizontal(anchor: AnchorRect): number {
  const vw = window.innerWidth;
  const centered = anchor.left + anchor.width / 2 - POPOVER_WIDTH / 2;
  if (centered >= MARGIN && centered + POPOVER_WIDTH <= vw - MARGIN) {
    return centered;
  }
  if (anchor.left + POPOVER_WIDTH <= vw - MARGIN) {
    return Math.max(MARGIN, anchor.left);
  }
  return Math.max(MARGIN, Math.min(anchor.right - POPOVER_WIDTH, vw - POPOVER_WIDTH - MARGIN));
}

function computeVertical(anchor: AnchorRect, height: number): number {
  const vh = window.innerHeight;
  if (anchor.bottom + GAP + height <= vh - MARGIN) {
    return anchor.bottom + GAP;
  }
  if (anchor.top - GAP - height >= MARGIN) {
    return anchor.top - GAP - height;
  }
  // Doesn't fully fit on either side (short viewport / very tall card, or an anchor whose
  // rect is itself partly off-screen - e.g. keyboard-focused while scrolled out of view) -
  // use whichever side has more room, then ALWAYS clamp into the viewport regardless of
  // that pick; an unclamped anchor.top/bottom here previously let the card land with a
  // negative top (rendered starting above the viewport, unreachable) whenever the anchor
  // itself wasn't fully on-screen. The card scrolls internally past this point anyway.
  const roomBelow = vh - anchor.bottom;
  const roomAbove = anchor.top;
  const preferBelow = roomBelow >= roomAbove;
  const raw = preferBelow ? anchor.bottom + GAP : anchor.top - GAP - height;
  return Math.max(MARGIN, Math.min(raw, vh - MARGIN - height));
}

type PopoverState = {
  open: boolean;
  subject: UserProfilePopoverSubject | null;
  left: number;
  top: number;
  anchor: AnchorRect | null;
  currentUserId: string | undefined;
  onMessageUser: ((userId: string) => void) | undefined;
  spaceRoleContext: SpaceMemberRoleEditContext | null;
};

export const [userProfilePopover, setUserProfilePopover] = createStore<PopoverState>({
  open: false,
  subject: null,
  left: 0,
  top: 0,
  anchor: null,
  currentUserId: undefined,
  onMessageUser: undefined,
  spaceRoleContext: null,
});

export function closeUserProfilePopover(): void {
  setUserProfilePopover({
    open: false,
    subject: null,
    anchor: null,
    onMessageUser: undefined,
    spaceRoleContext: null,
  });
}

/**
 * Re-run vertical placement once the card has actually rendered and its real height is
 * known - the FALLBACK_HEIGHT guess used for first paint is frequently wrong (role chips,
 * "about me", the join date row are all conditional), which used to pick the wrong
 * above/below flip and clip the card against the viewport edge.
 */
export function remeasureUserProfilePopover(height: number): void {
  const anchor = userProfilePopover.anchor;
  if (!anchor || !userProfilePopover.open) return;
  const top = computeVertical(anchor, height);
  if (Math.abs(top - userProfilePopover.top) > 1) {
    setUserProfilePopover('top', top);
  }
}

export function openUserProfilePopover(opts: {
  anchor: HTMLElement;
  subject: UserProfilePopoverSubject;
  currentUserId?: string;
  onMessageUser?: (userId: string) => void;
  spaceRoleContext?: SpaceMemberRoleEditContext | null;
}): void {
  const rect = toAnchorRect(opts.anchor.getBoundingClientRect());
  const left = computeHorizontal(rect);
  const top = computeVertical(rect, FALLBACK_HEIGHT);
  setUserProfilePopover({
    open: true,
    subject: opts.subject,
    left,
    top,
    anchor: rect,
    currentUserId: opts.currentUserId,
    onMessageUser: opts.onMessageUser,
    spaceRoleContext: opts.spaceRoleContext ?? null,
  });
}

export function openUserProfileFromParticipant(opts: {
  participant: RoomParticipant;
  anchor: HTMLElement;
  currentUserId?: string;
  onMessageUser?: (userId: string) => void;
  spaceRoles?: SpaceRole[];
  spaceRoleContext?: SpaceMemberRoleEditContext | null;
}): void {
  const p = opts.participant;
  const roleIds = (p as { roles?: string[] }).roles;
  const subject: UserProfilePopoverSubject = {
    userId: p.id,
    displayName: p.display_name || p.username || 'Unknown',
    username: p.username,
    discriminator: p.discriminator ?? 0,
    homeDomain: p.home_domain,
    avatar: p.avatar,
    banner: p.banner,
    aboutMe: p.about_me,
    bio: p.bio,
    spaceRoleNames: roleNamesForMember(roleIds, opts.spaceRoles),
    joinedAtLabel: spaceJoinedLabel(p),
  };
  openUserProfilePopover({
    anchor: opts.anchor,
    subject,
    currentUserId: opts.currentUserId,
    onMessageUser: opts.onMessageUser,
    spaceRoleContext: opts.spaceRoleContext,
  });
}
