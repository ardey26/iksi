import type { PageServerLoad } from './$types';
import { getProfileStats, getProfileTimeSeries } from '$lib/server/stats';

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();
  if (!user.handle) return { user, stats: null, timeSeries: null };

  const { prisma } = await import('$lib/prisma.js');
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return { user, stats: null, timeSeries: null };

  const [stats, timeSeries] = await Promise.all([
    getProfileStats(profile.id, { includeBots: false }),
    getProfileTimeSeries(profile.id, { days: 7 })
  ]);
  return { user, stats, timeSeries };
};
