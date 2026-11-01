import type { LayoutServerLoad } from './$types';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';
import { mediaUrl } from '#lib/server/media-url.js';
import { getCachedUser, setCachedUser, type CachedUserPayload } from '#lib/server/user-cache.js';

// Public profile pages are edge-cached and identical for every viewer, so the
// viewer's own user record must never be embedded in that HTML.
const PUBLIC_CACHED_ROUTES = new Set(['/@[handle]']);

export const load: LayoutServerLoad = async ({ cookies, route }) => {
  if (route.id && PUBLIC_CACHED_ROUTES.has(route.id)) return { user: null };

  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return { user: null };

  const cached = getCachedUser(uid);
  if (cached !== undefined) return { user: cached };

  const { prisma } = await import('#lib/prisma.js');
  const row = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true,
      twitterHandle: true,
      googleEmail: true,
      handle: { select: { handle: true } },
      profile: { select: { id: true, displayName: true, avatarUrl: true } }
    }
  });

  const user: CachedUserPayload | null = row
    ? {
        id: row.id,
        twitterHandle: row.twitterHandle ?? null,
        googleEmail: row.googleEmail ?? null,
        handle: row.handle?.handle ?? null,
        profileId: row.profile?.id ?? null,
        displayName: row.profile?.displayName ?? null,
        avatarUrl: row.profile?.avatarUrl ? mediaUrl(normalizeAvatarUrl(row.profile.avatarUrl)) : null
      }
    : null;

  setCachedUser(uid, user);
  return { user };
};
