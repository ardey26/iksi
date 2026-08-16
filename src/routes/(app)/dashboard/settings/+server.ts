import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUserSession } from '$lib/server/user-auth';

export const DELETE: RequestHandler = async ({ cookies }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });
  const { prisma } = await import('$lib/prisma.js');
  await prisma.user.delete({ where: { id: uid } });
  cookies.delete('user_session', { path: '/' });
  return json({ ok: true });
};
