import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/server/crypto.js';
import { recordClick } from '$lib/server/tracking';

const redirectCache = new Map();
const CACHE_TTL = 300000;
const MAX_CACHE_SIZE = 1000;

export const load = async (event) => {
	const { params, request, platform } = event;
	const slug = params.slug;
	const now = Date.now();
	const isHead = request.method === 'HEAD';

	const cached = redirectCache.get(slug);
	if (cached && cached.expires > now) {
		throw redirect(302, cached.url);
	}

	const longURL = await prisma.longURL.findFirst({
		where: { shortURL: slug },
		select: { id: true, originalURL: true }
	});

	if (!longURL) {
		throw error(404, 'not found');
	}

	const decodedURL = await decodeURL(longURL.originalURL);

	if (redirectCache.size >= MAX_CACHE_SIZE) {
		const oldestKey = redirectCache.keys().next().value;
		redirectCache.delete(oldestKey);
	}
	redirectCache.set(slug, { url: decodedURL, expires: now + CACHE_TTL });

	if (!isHead) {
		const p = recordClick(longURL.id, event);
		if (platform?.context?.waitUntil) {
			platform.context.waitUntil(p);
		} else {
			p.catch(() => {});
		}
	}

	throw redirect(302, decodedURL);
};
