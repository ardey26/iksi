import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/server/crypto.js';
import { isUnfurler } from '$lib/utils/botDetection.js';
import { detectDevice } from '$lib/utils/device.js';

const redirectCache = new Map();
const CACHE_TTL = 300000;
const MAX_CACHE_SIZE = 1000;

function trackClick(linkId, request) {
	const userAgent = request.headers.get('user-agent');
	const referrer = request.headers.get('referer');
	const country = request.headers.get('x-vercel-ip-country') || null;
	const device = detectDevice(userAgent);

	prisma.click.create({
		data: { linkId, referrer, userAgent, device, country }
	}).catch(err => console.error('Click tracking failed:', err));
}

function extractDomain(url) {
	try { return new URL(url).hostname; }
	catch { return url; }
}

export const load = async ({ params, request, cookies, locals }) => {
	const slug = params.slug;
	const now = Date.now();
	const userAgent = request.headers.get('user-agent');

	const cached = redirectCache.get(slug);
	let link;

	if (cached && cached.expires > now) {
		link = cached.link;
	} else {
		link = await prisma.longURL.findFirst({
			where: { shortURL: slug, deletedAt: null },
			select: { id: true, originalURL: true, showPreview: true, safeBrowsing: true }
		});

		if (link) {
			if (redirectCache.size >= MAX_CACHE_SIZE) {
				const oldestKey = redirectCache.keys().next().value;
				redirectCache.delete(oldestKey);
			}
			redirectCache.set(slug, { link, expires: now + CACHE_TTL });
		}
	}

	if (!link) throw error(404, 'not found');

	const decodedURL = await decodeURL(link.originalURL);
	trackClick(link.id, request);

	// Priority 1: Bot/unfurler
	if (isUnfurler(userAgent)) {
		return { isBot: true, destinationURL: decodedURL, domain: extractDomain(decodedURL), slug };
	}

	// Preview logic
	const linkWantsPreview = link.showPreview;
	let visitorWantsPreview = false;
	if (locals.user) {
		visitorWantsPreview = locals.user.showPreview;
	} else {
		visitorWantsPreview = cookies.get('iksi_preview_pref') === 'true';
	}

	// Priority 2: Show preview
	if (linkWantsPreview || visitorWantsPreview) {
		return {
			isBot: false, showPreview: true, destinationURL: decodedURL,
			domain: extractDomain(decodedURL), safeBrowsing: link.safeBrowsing, slug
		};
	}

	// Priority 3: Immediate redirect
	throw redirect(302, decodedURL);
};
