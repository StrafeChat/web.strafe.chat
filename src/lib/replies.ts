export const MAX_REPLY_TARGETS = 8;

export function addReplyTarget(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return [...ids];
  const next = [...ids, id];
  return next.length > MAX_REPLY_TARGETS ? next.slice(next.length - MAX_REPLY_TARGETS) : next;
}

export function removeReplyTarget(ids: readonly string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

export function mergeReplyTargets(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].slice(-MAX_REPLY_TARGETS);
}
