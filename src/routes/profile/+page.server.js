import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/server/crypto.js';

const PAGE_SIZE = 20;

export const load = async ({ url, locals }) => {
	const profileUser = locals.profileUser;
	const isOwner = locals.user?.id === profileUser?.id;

	// Parse pagination params
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const skip = (page - 1) * PAGE_SIZE;

	// Build query based on viewer
	const where = {
		ownerId: profileUser.id,
		deletedAt: null,
		// Only show listed links to non-owners
		...(isOwner ? {} : { listed: true })
	};

	const [links, total] = await Promise.all([
		prisma.longURL.findMany({
			where,
			select: {
				id: true,
				shortURL: true,
				originalURL: true,
				showPreview: true,
				listed: true,
				createdAt: true,
				_count: {
					select: { clicks: true }
				}
			},
			orderBy: { createdAt: 'desc' },
			skip,
			take: PAGE_SIZE
		}),
		prisma.longURL.count({ where })
	]);

	// Process links differently for owner vs visitor
	let processedLinks;

	if (isOwner) {
		// Owner gets detailed stats
		processedLinks = await Promise.all(
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
	} else {
		// Visitors get basic view
		processedLinks = await Promise.all(
			links.map(async (link) => {
				const destinationURL = await decodeURL(link.originalURL);

				return {
					slug: link.shortURL,
					destinationURL,
					showPreview: link.showPreview,
					createdAt: link.createdAt.toISOString(),
					clicks: link._count.clicks
				};
			})
		);
	}

	return {
		links: processedLinks,
		pagination: {
			page,
			pageSize: PAGE_SIZE,
			total,
			totalPages: Math.ceil(total / PAGE_SIZE)
		}
	};
};
