// One-off: mirror hot-linked avatars into R2. Run once after deploy:
//   pnpm --filter @iksi/web mirror-avatars [--dry-run]
// Needs DATABASE_URL and the R2_* env vars. --dry-run writes nothing.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '#lib/prisma.js';
import { fetchImage, mirrorAvatars } from '../src/lib/server/mirror';
import { prismaProfileMediaDb } from '../src/lib/server/profile-media';
import { r2MediaStore } from '../src/lib/server/media-store';

const dryRun = process.argv.includes('--dry-run');
const cdn = process.env.MEDIA_BASE_URL || 'https://cdn.iksi.app';

try {
	const rows = await prisma.profile.findMany({
		where: { avatarUrl: { not: null }, NOT: { avatarUrl: { startsWith: cdn } } },
		select: { id: true, userId: true, avatarUrl: true }
	});
	const profiles = rows.map((r) => ({
		profileId: r.id,
		userId: r.userId,
		avatarUrl: r.avatarUrl as string
	}));
	const report = await mirrorAvatars(profiles, {
		fetchImage: (url) => fetchImage(url),
		db: prismaProfileMediaDb(),
		store: r2MediaStore(),
		newId: () => randomUUID(),
		dryRun
	});
	console.log(JSON.stringify({ dryRun, ...report }, null, 2));
} finally {
	await prisma.$disconnect();
}
