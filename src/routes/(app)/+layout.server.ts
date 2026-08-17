import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { verifyUserSession } from '$lib/server/user-auth';

const CLAIM_EXEMPT_ROUTES = new Set(['/(app)/dashboard/claim', '/(app)/logout']);

export const load: LayoutServerLoad = async ({ cookies, route }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) throw redirect(302, '/login');

  const { prisma } = await import('$lib/prisma.js');
  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: { handle: true, profile: true }
  });
  if (!user) {
    cookies.delete('user_session', { path: '/' });
    throw redirect(302, '/login');
  }

  if (!user.handle && !CLAIM_EXEMPT_ROUTES.has(route.id ?? '')) {
    throw redirect(302, '/dashboard/claim');
  }

  return {
    user: {
      id: user.id,
      twitterHandle: user.twitterHandle,
      handle: user.handle?.handle ?? null,
      profileId: user.profile?.id ?? null,
      displayName: user.profile?.displayName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null
    }
  };
};
