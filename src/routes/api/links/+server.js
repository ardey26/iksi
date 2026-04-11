import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/server/crypto.js';

/**
 * GET /api/links - List authenticated user's links
 */
export const GET = async ({ url, locals }) => {
	if (!locals.user) {
		return json(
			{ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
			{ status: 401 }
		);
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
	const sortBy = url.searchParams.get('sortBy') || 'createdAt';
	const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

	// Validate sortBy
	const allowedSortFields = ['createdAt', 'shortURL'];
	if (!allowedSortFields.includes(sortBy)) {
		return json(
			{ error: { code: 'INVALID_SORT', message: 'Invalid sort field' } },
			{ status: 400 }
		);
	}

	const skip = (page - 1) * pageSize;

	const [links, total] = await Promise.all([
		prisma.longURL.findMany({
			where: {
				ownerId: locals.user.id,
				deletedAt: null
			},
			select: {
				id: true,
				shortURL: true,
				originalURL: true,
				showPreview: true,
				listed: true,
				safeBrowsing: true,
				createdAt: true,
				_count: {
					select: { clicks: true }
				}
			},
			orderBy: { [sortBy]: sortOrder },
			skip,
			take: pageSize
		}),
		prisma.longURL.count({
			where: {
				ownerId: locals.user.id,
				deletedAt: null
			}
		})
	]);

	// Decode URLs and calculate click stats
	const linksWithStats = await Promise.all(
		links.map(async (link) => {
			const destinationURL = await decodeURL(link.originalURL);

			// Get organic vs bot breakdown
			const [organicCount, botCount] = await Promise.all([
				prisma.click.count({
					where: { linkId: link.id, device: { not: 'bot' } }
				}),
				prisma.click.count({
					where: { linkId: link.id, device: 'bot' }
				})
			]);

			const totalClicks = organicCount + botCount;
			const organicPercent = totalClicks > 0 ? Math.round((organicCount / totalClicks) * 100) : 100;

			return {
				slug: link.shortURL,
				destinationURL,
				showPreview: link.showPreview,
				listed: link.listed,
				safeBrowsing: link.safeBrowsing,
				createdAt: link.createdAt.toISOString(),
				clicks: {
					total: totalClicks,
					organic: organicCount,
					bot: botCount,
					organicPercent
				}
			};
		})
	);

	return json({
		links: linksWithStats,
		pagination: {
			page,
			pageSize,
			total,
			totalPages: Math.ceil(total / pageSize)
		}
	});
};
