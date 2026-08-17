import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  if (!user.handle || !user.profileId) return { user, stats: null };

  // Stream: page shell renders immediately; the KPI numbers arrive when the DB responds.
  const stats = (async () => {
    const { prisma } = await import('$lib/prisma.js');
    const rows = await prisma.$queryRaw<Array<{ views: number; clicks: number }>>`
      SELECT
        (SELECT COUNT(*)::int FROM "ProfileView" WHERE "profileId" = ${user.profileId}) AS views,
        (SELECT COUNT(*)::int FROM "Click" WHERE "profileId" = ${user.profileId} AND "device" IS DISTINCT FROM 'bot') AS clicks
    `;
    const views = rows[0]?.views ?? 0;
    const clicks = rows[0]?.clicks ?? 0;
    return { views, clicks, ctr: views > 0 ? clicks / views : 0 };
  })();

  return { user, streamed: { stats } };
};
