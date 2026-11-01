import { prisma } from '#lib/prisma.js';

// Cache the sitemap in-memory for a bit so we're not hitting the DB on every crawl.
let cache = null;
let cacheExpires = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 min

const HEADERS = { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' };

function xmlEscape(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const day = (d) => d.toISOString().split('T')[0];

export async function GET() {
	const now = Date.now();
	if (cache && cacheExpires > now) return new Response(cache, { headers: HEADERS });

	// Only profiles with something on them: a bio or at least one live link.
	// Empty profiles are thin content and render noindex (see @[handle]/+page.svelte).
	let profiles = [];
	try {
		profiles = await prisma.profile.findMany({
			where: {
				user: { handle: { isNot: null } },
				OR: [
					{ AND: [{ bio: { not: null } }, { NOT: { bio: '' } }] },
					{ rows: { some: { enabled: true, quarantined: false, linkId: { not: null } } } }
				]
			},
			select: {
				updatedAt: true,
				user: { select: { handle: { select: { handle: true } } } },
				// Row changes don't touch Profile.updatedAt; the newest row counts as a change too.
				rows: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 }
			},
			orderBy: { updatedAt: 'desc' },
			take: 49999 // sitemap spec cap is 50k URLs per file, minus the homepage
		});
	} catch (err) {
		console.error('[sitemap] failed to load profiles', err);
	}

	// Google ignores changefreq/priority and only trusts lastmod when it is accurate,
	// so the homepage carries no lastmod rather than an always-today one.
	const profileUrls = profiles
		.filter((p) => p.user.handle)
		.map((p) => {
			const loc = `https://www.iksi.app/@${xmlEscape(p.user.handle.handle)}`;
			const newestRow = p.rows[0]?.createdAt;
			const lastmod = newestRow && newestRow > p.updatedAt ? newestRow : p.updatedAt;
			return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${day(lastmod)}</lastmod>\n  </url>`;
		})
		.join('\n');

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.iksi.app/</loc>
  </url>
${profileUrls}
</urlset>`;

	cache = sitemap;
	cacheExpires = now + CACHE_TTL;

	return new Response(sitemap, { headers: HEADERS });
}
