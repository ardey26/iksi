import { redirect, error } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { verifySession } from '$lib/server/auth.js';

const ADMIN_HOSTS = ['admin.iksi.app', 'admin.localhost'];

export const load = async ({ cookies, request }) => {
	const host = request.headers.get('host')?.split(':')[0] || '';
	const isAdminHost = ADMIN_HOSTS.includes(host);

	// Only allow admin access on admin subdomain
	if (!isAdminHost) {
		throw error(404, 'Not found');
	}

	const sessionToken = cookies.get('admin_session');
	const isAuthenticated = verifySession(sessionToken);

	if (!isAuthenticated) {
		throw redirect(302, '/admin/login');
	}

	try {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
		sevenDaysAgo.setHours(0, 0, 0, 0);

		// Run all queries in parallel (3 queries instead of 33)
		const [totalURLs, todayURLs, dailyStats, hourlyStats] = await Promise.all([
			// Total count
			prisma.longURL.count(),

			// Today's count
			prisma.longURL.count({
				where: { createdAt: { gte: today } }
			}),

			// Daily counts for last 7 days (single query with groupBy)
			prisma.$queryRaw`
				SELECT DATE("createdAt") as date, COUNT(*)::int as count
				FROM "LongURL"
				WHERE "createdAt" >= ${sevenDaysAgo}
				GROUP BY DATE("createdAt")
				ORDER BY date ASC
			`,

			// Hourly counts for today (single query with groupBy)
			prisma.$queryRaw`
				SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*)::int as count
				FROM "LongURL"
				WHERE "createdAt" >= ${today}
				GROUP BY EXTRACT(HOUR FROM "createdAt")
				ORDER BY hour ASC
			`
		]);

		// Build daily data with labels
		const dailyMap = new Map(dailyStats.map(d => [d.date.toISOString().split('T')[0], d.count]));
		const last7Days = [];
		const dailyData = [];

		for (let i = 6; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			date.setHours(0, 0, 0, 0);
			const dateKey = date.toISOString().split('T')[0];

			last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
			dailyData.push(dailyMap.get(dateKey) || 0);
		}

		// Build hourly data with labels
		const hourlyMap = new Map(hourlyStats.map(h => [h.hour, h.count]));
		const hourlyLabels = [];
		const hourlyData = [];

		for (let hour = 0; hour < 24; hour++) {
			hourlyLabels.push(`${hour}:00`);
			hourlyData.push(hourlyMap.get(hour) || 0);
		}

		return {
			stats: {
				totalURLs,
				todayURLs,
				chartData: {
					daily: {
						labels: last7Days,
						data: dailyData
					},
					hourly: {
						labels: hourlyLabels,
						data: hourlyData
					}
				}
			}
		};
	} catch (err) {
		console.error('Dashboard error:', err);
		return {
			stats: {
				totalURLs: 0,
				todayURLs: 0,
				chartData: {
					daily: { labels: [], data: [] },
					hourly: { labels: [], data: [] }
				}
			}
		};
	}
};
