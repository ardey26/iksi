// Read-only. The owner runs this against production; agents never do.
//   pnpm --filter @iksi/web seo-baseline
// Prints the sitemap's profile count and any LongURL rows that collide with reserved marketing paths.
import 'dotenv/config';
import { prisma } from '#lib/prisma.js';
import { _PROFILE_WITH_CONTENT } from '../src/routes/sitemap.xml/+server.js';

try {
	const profiles = await prisma.profile.count({ where: _PROFILE_WITH_CONTENT });
	const reserved = await prisma.longURL.findMany({
		where: { shortURL: { in: ['alternatives', 'features', 'tools', 'docs'] } },
		select: { id: true, shortURL: true, createdAt: true }
	});
	console.log(JSON.stringify({ sitemapProfiles: profiles, reservedSlugUrls: reserved }, null, 2));
} finally {
	await prisma.$disconnect();
}
