import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { rateLimit } from '$lib/rateLimit.js';
import { SHORT_URL } from '$lib/config.js';
import { addPrefix, isValidURLServer, isValidAlias } from '$lib/utils/urlValidation.js';
import { createURLHash } from '$lib/utils/urlHash.js';
import { encodeURL, decodeURL } from '$lib/server/crypto.js';
import { randomBytes } from 'crypto';

// Rate limits per hour
const RATE_LIMITS = {
	anonymous: { requests: 15, windowMs: 3600000 },
	session: { requests: 60, windowMs: 3600000 },
	apiKey: { requests: 600, windowMs: 3600000 }
};

/**
 * Generate a unique short URL slug
 */
const generateShortURL = async (retries = SHORT_URL.retries) => {
	if (!retries) {
		throw new Error('Number of collisions exceeded maximum retries, please try again.');
	}

	// Optimized character set (removed confusing chars like 0, O, I, l)
	const availableChars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let shortURL = '';

	const lengthOfShortUrl = SHORT_URL.length;

	// Use crypto for better randomness
	const randomBytesArray = randomBytes(lengthOfShortUrl);

	for (let i = 0; i < lengthOfShortUrl; i++) {
		const randomIndex = randomBytesArray[i] % availableChars.length;
		shortURL += availableChars[randomIndex];
	}

	const hasCollision = await prisma.longURL.findFirst({
		where: { shortURL },
		select: { id: true }
	});

	if (hasCollision) {
		return generateShortURL(retries - 1);
	}

	return shortURL;
};

/**
 * Determine auth type from request
 * Returns: 'apiKey', 'session', or 'anonymous'
 */
const getAuthType = (request, user) => {
	if (!user) return 'anonymous';

	const authHeader = request.headers.get('authorization');
	if (authHeader?.startsWith('Bearer ik_')) {
		return 'apiKey';
	}

	return 'session';
};

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

/**
 * POST /api/links - Create a new short link
 */
export const POST = async ({ request, locals, getClientAddress }) => {
	try {
		const user = locals.user;
		const authType = getAuthType(request, user);

		// Rate limiting by auth type
		const rateLimitConfig = RATE_LIMITS[authType];
		const identifier = user ? `user:${user.id}` : `ip:${getClientAddress()}`;
		const rateLimitResult = await rateLimit(identifier, rateLimitConfig.requests, rateLimitConfig.windowMs);

		if (!rateLimitResult.allowed) {
			return json(
				{ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
				{
					status: 429,
					headers: {
						'X-RateLimit-Remaining': '0',
						'X-RateLimit-Reset': '3600'
					}
				}
			);
		}

		// Check content length
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 4096) {
			return json(
				{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } },
				{ status: 413 }
			);
		}

		// Parse request body with backwards compatibility
		const body = await request.json();
		const longURL = body.url || body.longURL;
		const customSlug = body.customSlug || body.customURL;
		const showPreview = Boolean(body.showPreview);
		// listed is only for authenticated users, default false
		const listed = user ? Boolean(body.listed) : false;

		// Validate URL
		if (!longURL || typeof longURL !== 'string') {
			return json(
				{ error: { code: 'URL_REQUIRED', message: 'A valid URL is required' } },
				{ status: 400 }
			);
		}

		if (longURL.length > 2048) {
			return json(
				{ error: { code: 'URL_TOO_LONG', message: 'URL is too long (max 2048 characters)' } },
				{ status: 400 }
			);
		}

		const prefixedURL = addPrefix(longURL.trim());

		if (!isValidURLServer(prefixedURL)) {
			return json(
				{ error: { code: 'INVALID_URL', message: 'The provided URL is invalid' } },
				{ status: 400 }
			);
		}

		let shortURL;

		// Handle custom slug
		if (customSlug) {
			const trimmedSlug = customSlug.trim();

			if (trimmedSlug.length > 50) {
				return json(
					{ error: { code: 'SLUG_TOO_LONG', message: 'Custom slug is too long (max 50 characters)' } },
					{ status: 400 }
				);
			}

			if (!isValidAlias(trimmedSlug)) {
				return json(
					{ error: { code: 'INVALID_SLUG', message: 'Custom slug can only contain letters, numbers, hyphens, and underscores' } },
					{ status: 400 }
				);
			}

			// Check slug uniqueness
			const slugExists = await prisma.longURL.findFirst({
				where: { shortURL: trimmedSlug },
				select: { id: true }
			});

			if (slugExists) {
				return json(
					{ error: { code: 'SLUG_EXISTS', message: 'This custom slug is already taken' } },
					{ status: 409 }
				);
			}

			shortURL = trimmedSlug;
		} else {
			// Check for deduplication (same owner or null owner)
			const urlHash = await createURLHash(prefixedURL);
			const ownerId = user?.id || null;

			const existingLink = await prisma.longURL.findFirst({
				where: {
					urlHash,
					ownerId,
					deletedAt: null
				},
				select: {
					shortURL: true,
					showPreview: true,
					listed: true,
					createdAt: true
				}
			});

			if (existingLink) {
				// Return existing link for deduplication
				return json({
					slug: existingLink.shortURL,
					shortURL: existingLink.shortURL, // backwards compat
					showPreview: existingLink.showPreview,
					listed: existingLink.listed,
					createdAt: existingLink.createdAt.toISOString()
				});
			}

			shortURL = await generateShortURL();
		}

		// Create the new link
		const urlHash = await createURLHash(prefixedURL);
		const encodedURL = encodeURL(prefixedURL);

		const newLink = await prisma.longURL.create({
			data: {
				originalURL: encodedURL,
				urlHash,
				shortURL,
				showPreview,
				listed,
				ownerId: user?.id || null
			},
			select: {
				shortURL: true,
				showPreview: true,
				listed: true,
				createdAt: true
			}
		});

		return json({
			slug: newLink.shortURL,
			shortURL: newLink.shortURL, // backwards compat
			showPreview: newLink.showPreview,
			listed: newLink.listed,
			createdAt: newLink.createdAt.toISOString()
		});
	} catch (error) {
		console.error('Error in POST /api/links:', error);

		// Handle JSON parse errors
		if (error instanceof SyntaxError) {
			return json(
				{ error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
				{ status: 400 }
			);
		}

		// Handle Prisma errors
		if (error.name === 'PrismaClientKnownRequestError') {
			return json(
				{ error: { code: 'DATABASE_ERROR', message: 'Database error occurred' } },
				{ status: 503 }
			);
		}

		// Handle timeout errors
		if (error.message?.includes('timeout')) {
			return json(
				{ error: { code: 'TIMEOUT', message: 'Request timed out, please try again' } },
				{ status: 504 }
			);
		}

		return json(
			{ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
			{ status: 500 }
		);
	}
};
