import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/server/crypto.js';

// In-memory cache for popular redirects
const redirectCache = new Map();
const CACHE_TTL = 300000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

export const load = async ({ params }) => {
	const slug = params.slug;
	const now = Date.now();

	// Check cache first
	const cached = redirectCache.get(slug);
	if (cached && cached.expires > now) {
		throw redirect(302, cached.url);
	}

	const longURL = await prisma.longURL.findFirst({
		where: {
			shortURL: slug
		},
		select: {
			originalURL: true
		}
	});

	if (!longURL) {
		throw error(404, 'not found');
	}

	const decodedURL = await decodeURL(longURL.originalURL);

	// Cache the result (evict oldest if full)
	if (redirectCache.size >= MAX_CACHE_SIZE) {
		const oldestKey = redirectCache.keys().next().value;
		redirectCache.delete(oldestKey);
	}
	redirectCache.set(slug, { url: decodedURL, expires: now + CACHE_TTL });

	throw redirect(302, decodedURL);
};
