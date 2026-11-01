import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Daily: erase the content of one-time links that expired without being
 * opened. Expired secrets are never served, but "burn after reading" means
 * the content must not outlive the link either.
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
  return json({ erased: count });
};
