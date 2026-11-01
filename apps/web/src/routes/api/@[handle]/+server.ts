import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { normalizeAvatarUrl } from '#lib/server/avatar-url.js';
import { mediaUrl } from '#lib/server/media-url.js';
import { clientOf } from '#lib/server/client.js';

const PUBLIC_LIMIT_PER_HOUR = 100;

async function checkAndBump(key: string, max: number): Promise<boolean> {
  const { prisma } = await import('#lib/prisma.js');
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { id: key } });
  if (existing && existing.resetAt > now) {
    if (existing.count >= max) return false;
    await prisma.rateLimit.update({ where: { id: key }, data: { count: { increment: 1 } } });
    return true;
  }
  await prisma.rateLimit.upsert({
    where: { id: key },
    create: { id: key, count: 1, resetAt: new Date(now.getTime() + 3600_000) },
    update: { count: 1, resetAt: new Date(now.getTime() + 3600_000) }
  });
  return true;
}

export const GET: RequestHandler = async (event) => {
  const { params } = event;
  const key = `public_api:ip:${clientOf(event).ip}`;
  const ok = await checkAndBump(key, PUBLIC_LIMIT_PER_HOUR);
  if (!ok) return json({ error: 'Rate limited' }, { status: 429 });

  const raw = params.handle;
  const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

  const { prisma } = await import('#lib/prisma.js');
  const record = await prisma.handle.findUnique({
    where: { handle },
    include: {
      user: {
        include: {
          profile: {
            include: {
              rows: {
                where: { enabled: true, quarantined: false, NOT: { linkId: null } },
                orderBy: { position: 'asc' },
                include: { link: { select: { shortURL: true, clickCount: true } } }
              }
            }
          }
        }
      }
    }
  });
  if (!record?.user?.profile) return json({ error: 'Not found' }, { status: 404 });
  const p = record.user.profile;

  return json({
    handle,
    displayName: p.displayName,
    bio: p.bio,
    avatarUrl: p.avatarUrl ? mediaUrl(normalizeAvatarUrl(p.avatarUrl)) : null,
    theme: p.theme,
    accent: p.accent,
    rows: p.rows.map((r) => ({
      title: r.title,
      url: `https://iksi.app/${r.link!.shortURL}`,
      ...(p.publicClicks ? { clicks: r.link!.clickCount } : {})
    }))
  });
};
