import type { LayoutServerLoad } from './$types';
import { verifyUserSession } from '$lib/server/user-auth';

export const load: LayoutServerLoad = async ({ cookies }) => {
  const uid = verifyUserSession(cookies.get('user_session'));
  if (uid === null) return { user: null };

  const { prisma } = await import('$lib/prisma.js');
  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: { handle: true, profile: true }
  });
  if (!user) return { user: null };

  return {
    user: {
      id: user.id,
      twitterHandle: user.twitterHandle ?? null,
      googleEmail: user.googleEmail ?? null,
      handle: user.handle?.handle ?? null,
      displayName: user.profile?.displayName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null
    }
  };
};
