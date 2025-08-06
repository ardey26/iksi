import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';

export const load = async ({ cookies }) => {
	// Check if user is authenticated
	const isAuthenticated = cookies.get('admin_authenticated') === 'true';
	
	if (!isAuthenticated) {
		throw redirect(302, '/admin/login');
	}
	
	try {
		// Get website analytics
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
		
		// Get daily URL creation data for the last 7 days
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
		
		// Get hourly data for today
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
	} catch (error) {
		console.error('Dashboard error:', error);
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
