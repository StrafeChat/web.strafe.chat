/**
 * USER_UPDATE — keep auth user, room participants, relationships, and space member lists in sync when profiles change.
 */

import { onStargateEvent } from '../services/stargate/client';
import { auth, setAuthUser } from './auth';
import { setRelationships } from './relationships';
import { setRooms } from './rooms';
import { setSpaceMembers } from './spaceMembers';
import type { Relationship } from '../api/relationships';
import type { RoomParticipant } from '../api/rooms';

function parseDisc(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function patchFromPayload(data: Record<string, unknown>): Partial<RoomParticipant> {
  const out: Partial<RoomParticipant> = {};
  if (typeof data.avatar === 'string') out.avatar = data.avatar;
  if (typeof data.banner === 'string') out.banner = data.banner;
  if (typeof data.display_name === 'string') out.display_name = data.display_name;
  if (typeof data.username === 'string') out.username = data.username;
  if (typeof data.bio === 'string') out.bio = data.bio;
  if (typeof data.about_me === 'string') out.about_me = data.about_me;
  if (typeof data.pronouns === 'string') out.pronouns = data.pronouns;
  if (typeof data.birthday === 'string') out.birthday = data.birthday;
  if (typeof data.is_birthday === 'boolean') out.is_birthday = data.is_birthday;
  const d = parseDisc(data.discriminator);
  if (d !== undefined) out.discriminator = d;
  return out;
}

export function initUserProfileHandler(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'USER_UPDATE') return;
    const ep = event.d as { d?: Record<string, unknown> } | undefined;
    const data = ep?.d;
    if (!data || typeof data !== 'object') return;
    const userId = typeof data.user_id === 'string' ? data.user_id : null;
    if (!userId) return;

    const patch = patchFromPayload(data as Record<string, unknown>);

    const selfId = auth.user?.id;
    if (selfId === userId && auth.user) {
      const disc = parseDisc(data.discriminator);
      setAuthUser({
        ...auth.user,
        ...patch,
        display_name: typeof data.display_name === 'string' ? data.display_name : auth.user.display_name,
        username: typeof data.username === 'string' ? data.username : auth.user.username,
        discriminator: disc ?? auth.user.discriminator,
        avatar: typeof data.avatar === 'string' ? data.avatar : auth.user.avatar,
        banner: typeof data.banner === 'string' ? data.banner : auth.user.banner,
        bio: typeof data.bio === 'string' ? data.bio : auth.user.bio,
        about_me: typeof data.about_me === 'string' ? data.about_me : auth.user.about_me,
        pronouns: typeof data.pronouns === 'string' ? data.pronouns : auth.user.pronouns,
        birthday: typeof data.birthday === 'string' ? data.birthday : auth.user.birthday,
      });
    }

    setRelationships('relationships', (rels: Relationship[]) =>
      rels.map((r) =>
        r.user.id === userId
          ? {
              ...r,
              user: {
                ...r.user,
                ...patch,
                display_name: (data.display_name as string) ?? r.user.display_name,
                username: (data.username as string) ?? r.user.username,
                avatar: typeof data.avatar === 'string' ? data.avatar : r.user.avatar,
                banner: typeof data.banner === 'string' ? data.banner : r.user.banner,
                bio: typeof data.bio === 'string' ? data.bio : r.user.bio,
                about_me: typeof data.about_me === 'string' ? data.about_me : r.user.about_me,
                pronouns: typeof data.pronouns === 'string' ? data.pronouns : r.user.pronouns,
                birthday: typeof data.birthday === 'string' ? data.birthday : r.user.birthday,
                is_birthday: typeof data.is_birthday === 'boolean' ? data.is_birthday : r.user.is_birthday,
                discriminator:
                  typeof data.discriminator === 'string'
                    ? data.discriminator
                    : String(r.user.discriminator ?? '0').padStart(4, '0'),
              },
            }
          : r,
      ),
    );

    setRooms('rooms', (list) =>
      list.map((room) => ({
        ...room,
        participants: room.participants?.map((p) =>
          p.id === userId
            ? {
                ...p,
                ...patch,
                display_name: (data.display_name as string) ?? p.display_name,
                bio: typeof data.bio === 'string' ? data.bio : p.bio,
                about_me: typeof data.about_me === 'string' ? data.about_me : p.about_me,
                pronouns: typeof data.pronouns === 'string' ? data.pronouns : p.pronouns,
                birthday: typeof data.birthday === 'string' ? data.birthday : p.birthday,
                is_birthday: typeof data.is_birthday === 'boolean' ? data.is_birthday : p.is_birthday,
              }
            : p,
        ),
      })),
    );

    setSpaceMembers('bySpaceId', (prev) => {
      const next: typeof prev = { ...prev };
      for (const sid of Object.keys(next)) {
        const list = next[sid];
        if (!list?.length) continue;
        next[sid] = list.map((m) =>
          m.id === userId
            ? {
                ...m,
                ...patch,
                display_name: (data.display_name as string) ?? m.display_name,
                username: (data.username as string) ?? m.username,
                bio: typeof data.bio === 'string' ? data.bio : m.bio,
                about_me: typeof data.about_me === 'string' ? data.about_me : m.about_me,
                pronouns: typeof data.pronouns === 'string' ? data.pronouns : m.pronouns,
                birthday: typeof data.birthday === 'string' ? data.birthday : m.birthday,
                is_birthday: typeof data.is_birthday === 'boolean' ? data.is_birthday : m.is_birthday,
              }
            : m,
        );
      }
      return next;
    });
  });
}
