import { prisma } from '$lib/prisma.js';

// Cache the sitemap in-memory for a bit so we're not hitting the DB on every crawl.
let cache = null;
let cacheExpires = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 min

function xmlEscape(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
	const now = Date.now();
	if (cache && cacheExpires > now) {
		return new Response(cache, {
			headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' }
		});
	}

	const today = new Date().toISOString().split('T')[0];

	// All claimed handles get their public profile URL in the sitemap so Google
	// discovers and indexes them. Only claimed handles are actually reachable.
	let handles = [];
	try {
		handles = await prisma.handle.findMany({
			select: { handle: true, claimedAt: true },
			orderBy: { claimedAt: 'desc' },
			take: 50000 // sitemap spec cap is 50k URLs per file
		});
	} catch (err) {
		console.error('[sitemap] failed to load handles', err);
	}

	const profileUrls = handles
		.map((h) => {
			const loc = `https://www.iksi.app/@${xmlEscape(h.handle)}`;
			const lastmod = h.claimedAt.toISOString().split('T')[0];
			return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
		})
		.join('\n');

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.iksi.app/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${profileUrls}
</urlset>`;

	cache = sitemap;
	cacheExpires = now + CACHE_TTL;

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
