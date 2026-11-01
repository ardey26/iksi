import type { RequestEvent } from '@sveltejs/kit';
import { addCacheTag, dangerouslyDeleteByTag } from '@vercel/functions';
import { verifyUserSession } from '#lib/server/user-auth.js';

/**
 * Public profile pages are cached on Vercel's CDN (see @[handle]/+page.server.ts).
 * Each cached page is tagged with its owner, and any successful update by that
 * owner deletes the tag, so the next visit renders fresh instead of serving the
 * old page until the cache expires.
 */
export const profileCacheTag = (userId: number): string => `profile-${userId}`;

export async function tagProfile(userId: number): Promise<void> {
  try {
    await addCacheTag(profileCacheTag(userId));
  } catch (e) {
    console.error('profile-cache: tag failed', e);
  }
}

/** Never throws: a failed purge only means the page stays stale until it expires. */
export async function purgeProfile(userId: number): Promise<void> {
  try {
    await dangerouslyDeleteByTag(profileCacheTag(userId));
  } catch (e) {
    console.error('profile-cache: purge failed', e);
  }
}

/** Wraps a mutation handler: after a 2xx response, purge the signed-in owner's profile page. */
export function purgeProfileOnSuccess<E extends Pick<RequestEvent, 'cookies'>>(
  handler: (event: E) => Response | Promise<Response>
): (event: E) => Promise<Response> {
  return async (event) => {
    const res = await handler(event);
    if (res.ok) {
      const uid = verifyUserSession(event.cookies.get('user_session'));
      if (uid !== null) await purgeProfile(uid);
    }
    return res;
  };
}
