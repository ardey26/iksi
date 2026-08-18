import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUserSession } from '$lib/server/user-auth';
import { encodeURL } from '$lib/server/crypto.js';

export const PATCH: RequestHandler = async ({ request, cookies }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });
  const { id, originalURL } = await request.json();
  if (!Number.isInteger(id) || typeof originalURL !== 'string') return json({ error: 'Invalid input' }, { status: 400 });

  const { prisma } = await import('$lib/prisma.js');
  const link = await prisma.longURL.findUnique({ where: { id } });
  if (!link || link.userId !== uid) return json({ error: 'Not found' }, { status: 404 });

  const encoded = encodeURL(originalURL);
  await prisma.longURL.update({ where: { id }, data: { originalURL: encoded } });
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await request.json();
  if (!Number.isInteger(id)) return json({ error: 'Invalid input' }, { status: 400 });

  const { prisma } = await import('$lib/prisma.js');
  const link = await prisma.longURL.findUnique({ where: { id } });
  if (!link || link.userId !== uid) return json({ error: 'Not found' }, { status: 404 });

  // Cascade: kill any ProfileRow that referenced this link too. Schema uses
  // SetNull, but the unified links UI treats a link and its public row as one
  // entity — leaving orphaned rows labeled "deleted" would surprise the user.
  await prisma.$transaction([
    prisma.profileRow.deleteMany({ where: { linkId: id } }),
    prisma.longURL.delete({ where: { id } })
  ]);
  return json({ ok: true });
};
