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
		const totalURLs = await prisma.longURL.count();

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const todayURLs = await prisma.longURL.count({
			where: {
				createdAt: {
					gte: today
				}
			}
		});

		const last7Days = [];
		const dailyData = [];

		for (let i = 6; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			date.setHours(0, 0, 0, 0);

			const nextDay = new Date(date);
			nextDay.setDate(nextDay.getDate() + 1);

			const count = await prisma.longURL.count({
				where: {
					createdAt: {
						gte: date,
						lt: nextDay
					}
				}
			});

			last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
			dailyData.push(count);
		}

		const hourlyData = [];
		const hourlyLabels = [];

		for (let hour = 0; hour < 24; hour++) {
			const startOfHour = new Date();
			startOfHour.setHours(hour, 0, 0, 0);

			const endOfHour = new Date();
			endOfHour.setHours(hour + 1, 0, 0, 0);

			const count = await prisma.longURL.count({
				where: {
					createdAt: {
						gte: startOfHour,
						lt: endOfHour
					}
				}
			});

			hourlyLabels.push(`${hour}:00`);
			hourlyData.push(count);
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
