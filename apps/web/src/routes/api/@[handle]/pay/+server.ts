import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clientOf } from '#lib/server/client.js';
import { rateLimit } from '#lib/rateLimit.js';
import { readPayMethods } from '#lib/server/pay-methods.js';

// The QR payloads behind a profile's Pay button, fetched when the sheet opens.
// A personal QR Ph payload usually holds the owner's mobile number, so it is
// kept out of the cached profile page and never cached here either. The data
// is public (anyone who opens Pay sees it); the rate limit only slows scraping.

const LIMIT_PER_HOUR = 120;
const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

export const GET: RequestHandler = async (event) => {
	const rl = await rateLimit(`pay-qr:ip:${clientOf(event).ip}`, LIMIT_PER_HOUR, 3_600_000);
	if (!rl.allowed) return json({ error: 'Rate limited' }, { status: 429, headers: HEADERS });

	const raw = event.params.handle;
	const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

	const { prisma } = await import('#lib/prisma.js');
	const p = await prisma.profile.findFirst({
		where: { user: { handle: { handle } } },
		select: { payMethods: true }
	});
	if (!p) return json({ error: 'Not found' }, { status: 404, headers: HEADERS });

	// Re-validated on read, like the page: a stored payload that no longer passes is never served.
	const payloads: Record<string, string> = {};
	for (const m of readPayMethods(p.payMethods)) if (m.kind === 'qr') payloads[m.id] = m.payload;
	return json({ payloads }, { headers: HEADERS });
};
