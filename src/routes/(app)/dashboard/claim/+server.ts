import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateHandle } from '$lib/server/handles';
import { verifyUserSession } from '$lib/server/user-auth';
import { invalidateUserCache } from '$lib/server/user-cache';

const CLAIM_LIMIT_PER_HOUR_IP = 3;
const CLAIM_LIMIT_PER_HOUR_USER = 1;

async function checkAndBump(key: string, max: number): Promise<boolean> {
  const { prisma } = await import('$lib/prisma.js');
  const now = new Date();
  const existing = await prisma.handleClaimRateLimit.findUnique({ where: { id: key } });
  if (existing && existing.resetAt > now) {
    if (existing.count >= max) return false;
    await prisma.handleClaimRateLimit.update({
      where: { id: key },
      data: { count: { increment: 1 } }
    });
    return true;
  }
  await prisma.handleClaimRateLimit.upsert({
    where: { id: key },
    create: { id: key, count: 1, resetAt: new Date(now.getTime() + 3600_000) },
    update: { count: 1, resetAt: new Date(now.getTime() + 3600_000) }
  });
  return true;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });

  const { handle } = await request.json();
  const normalized = typeof handle === 'string' ? handle.trim().toLowerCase() : '';
  const v = validateHandle(normalized);
  if (!v.ok) return json({ error: v.error }, { status: 400 });

  const ipOk = await checkAndBump(`handle_claim:ip:${getClientAddress()}`, CLAIM_LIMIT_PER_HOUR_IP);
  const userOk = await checkAndBump(`handle_claim:user:${uid}`, CLAIM_LIMIT_PER_HOUR_USER);
  if (!ipOk || !userOk) return json({ error: 'Too many attempts, wait an hour' }, { status: 429 });

  const { prisma } = await import('$lib/prisma.js');
  try {
    await prisma.handle.create({ data: { handle: v.handle, userId: uid } });
    invalidateUserCache(uid);
    return json({ ok: true, handle: v.handle });
  } catch (err: any) {
    if (err?.code === 'P2002') return json({ error: 'That handle is taken' }, { status: 409 });
    throw err;
  }
};
