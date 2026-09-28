/**
 * Shared helper for Stargate event handlers. Role and override events are applied
 * straight into the spaces store (see stores/spaces.ts initSpaceHandlers) - this module
 * used to bump revision counters that made every page re-fetch roles and overrides.
 */

/** Stargate EventPayload wraps business data in `.d`; normalize to a flat object. */
export function stargateEventInnerRecord(event: { d: unknown }): Record<string, unknown> | null {
  const outer = event.d as { d?: unknown } | null | undefined;
  const inner =
    outer && typeof outer === 'object' && outer !== null && 'd' in outer
      ? (outer as { d: unknown }).d
      : event.d;
  if (!inner || typeof inner !== 'object') return null;
  return inner as Record<string, unknown>;
}
