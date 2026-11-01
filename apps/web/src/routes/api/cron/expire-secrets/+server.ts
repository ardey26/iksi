import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Daily:
 * - erase the content of one-time links that expired without being opened.
 *   Expired secrets are never served, but "burn after reading" means the
 *   content must not outlive the link either.
 * - delete rate-limit counters whose window ended over a day ago, so the
 *   (hashed) per-visitor keys do not pile up. Here rather than in a cron of
 *   its own: the Vercel plan allows two.
 */
export const GET: RequestHandler = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { prisma } = await import('#lib/prisma.js');
  const { count } = await prisma.longURL.updateMany({
    where: { oneTime: true, openedAt: null, secret: { not: null }, expiresAt: { lt: new Date() } },
    data: { secret: null }
  });
  const { cleanupRateLimits } = await import('#lib/rateLimit.js');
  const rateLimits = await cleanupRateLimits();
  return json({ erased: count, rateLimits });
};
