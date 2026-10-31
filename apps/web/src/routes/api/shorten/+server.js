import { prisma } from '#lib/prisma.js';
import { rateLimit } from '#lib/rateLimit.js';
import { RATE_LIMIT, SHORT_URL } from '#lib/config.js';
import { addPrefix, isValidURLServer, isValidAlias } from '#lib/utils/urlValidation.js';
import { createURLHash } from '#lib/utils/urlHash.js';
import { encodeURL } from '#lib/server/crypto.js';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { randomBytes } from 'crypto';
import { clientOf } from '#lib/server/client.js';
import { settleVerdictInBackground } from '#lib/server/link-verdict.js';
import { FLAGGED_VERDICTS } from '#lib/server/link-record.js';

/** What anonymous dedupe needs to know about the row already holding a urlHash. */
const DEDUPE_SELECT = {
	shortURL: true,
	userId: true,
	rules: true,
	passwordHash: true,
	expiresAt: true,
	maxClicks: true,
	expiredAt: true,
	permanent: true,
	safeVerdict: true
};

/**
 * Anonymous dedupe may only hand out a plain anonymous link. Rows created by
 * signed-in users before urlHash stopped being stored for them still carry
 * one, and an owner can add a password, rules or expiry (or change the
 * destination) after the hash was written.
 */
function reusable(row) {
	const rules = Array.isArray(row.rules) ? row.rules.length > 0 : row.rules != null;
	return (
		row.userId === null &&
		!rules &&
		row.passwordHash === null &&
		row.expiresAt === null &&
		row.maxClicks === null &&
		row.expiredAt === null &&
		!row.permanent &&
		!(row.safeVerdict !== null && FLAGGED_VERDICTS.includes(row.safeVerdict))
	);
}

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
		where: {
			shortURL: shortURL
		},
		select: {
			id: true
		}
	});

	if (hasCollision) {
		const newRetries = retries - 1;
		return generateShortURL(newRetries); // Fixed: added return statement
	}

	return shortURL;
};


export const POST = async (event) => {
	const { request, cookies } = event;
	try {
		// Rate limiting
		const clientIP = clientOf(event).ip;
		const rateLimitResult = await rateLimit(clientIP, RATE_LIMIT.requests, RATE_LIMIT.windowMs);
		
		if (!rateLimitResult.allowed) {
			return new Response(JSON.stringify({ error: 'Too many requests. Please wait a minute.' }), {
				status: 429,
				headers: { 
					'Content-Type': 'application/json',
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': '60'
				}
			});
		}

		// Check content length
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 4096) { // 4KB limit
			return new Response(JSON.stringify({ error: 'Request body too large' }), {
				status: 413,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const { longURL, customURL } = await request.json();
		const uid = verifyUserSession(cookies.get('user_session'));

		// Input validation
		if (!longURL || typeof longURL !== 'string') {
			return new Response(JSON.stringify({ error: 'A valid URL is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (longURL.length > 2048) {
			return new Response(JSON.stringify({ error: 'URL is too long (max 2048 characters)' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		let shortURL;
		// Only store a urlHash for auto-generated shortens (so dedup-by-hash works).
		// Custom aliases intentionally store NULL so the user can have multiple
		// custom shorts pointing at the same long URL without tripping the unique constraint.
		let urlHashForStore = null;

		const prefixedURL = addPrefix(longURL.trim());

		if (!isValidURLServer(prefixedURL)) {
			return new Response(JSON.stringify({ error: 'you provided an invalid URL' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (customURL) {
			const trimmedCustomURL = customURL.trim();

			if (trimmedCustomURL.length > 50) {
				return new Response(JSON.stringify({ error: 'Custom alias is too long (max 50 characters)' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (!isValidAlias(trimmedCustomURL)) {
				return new Response(JSON.stringify({ error: 'you provided an invalid alias' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			const customURLExists = await prisma.longURL.findFirst({
				where: {
					shortURL: trimmedCustomURL
				},
				select: {
					id: true
				}
			});

			if (customURLExists) {
				return new Response(
					JSON.stringify({ error: 'custom link alias already exists, pick another one' }), {
						status: 409,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			shortURL = trimmedCustomURL;
		} else {
			const urlHash = await createURLHash(prefixedURL);

			if (uid !== null) {
				// Logged-in: dedupe only against links THIS user already owns.
				// urlHash is NOT stored on new rows (would collide with the global unique
				// constraint if another user already shortened the same URL). Trade-off:
				// no dedupe for this user's future shortens of the same URL, in exchange
				// for guaranteed ownership.
				const mine = await prisma.longURL.findFirst({
					where: { userId: uid, urlHash: urlHash },
					select: { shortURL: true }
				});
				if (mine) {
					return new Response(JSON.stringify({ shortURL: mine.shortURL }), {
						headers: { 'Content-Type': 'application/json' }
					});
				}
				shortURL = await generateShortURL();
				urlHashForStore = null;
			} else {
				// Anonymous: global dedupe, but only onto a plain anonymous link.
				const isShortened = await prisma.longURL.findFirst({
					where: { urlHash: urlHash },
					select: DEDUPE_SELECT
				});
				if (isShortened && reusable(isShortened)) {
					return new Response(JSON.stringify({ shortURL: isShortened.shortURL }), {
						headers: { 'Content-Type': 'application/json' }
					});
				}
				shortURL = await generateShortURL();
				// urlHash is unique: a row that cannot be reused keeps it, so this one stores none.
				urlHashForStore = isShortened ? null : urlHash;
			}
		}

		const encodedURL = encodeURL(prefixedURL);
		const insert = (urlHash) =>
			prisma.longURL.create({
				data: {
					originalURL: encodedURL,
					urlHash,
					shortURL: shortURL,
					userId: uid
				},
				select: {
					id: true,
					shortURL: true,
					clickCount: true,
					createdAt: true,
					safeVerdict: true
				}
			});

		let url;
		try {
			url = await insert(urlHashForStore);
		} catch (err) {
			// Concurrent insert race: another request claimed this urlHash a moment ago.
			// Reuse what they got when it is plain; otherwise store this link without the hash.
			if (err.code !== 'P2002' || !urlHashForStore || !err.meta?.target?.includes?.('urlHash')) throw err;
			const existing = await prisma.longURL.findFirst({
				where: { urlHash: urlHashForStore },
				select: DEDUPE_SELECT
			});
			if (existing && reusable(existing)) {
				return new Response(JSON.stringify({ shortURL: existing.shortURL }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}
			url = await insert(null);
		}

		// Fire safe-browsing async; failures never block shorten response
		settleVerdictInBackground(url.shortURL, [prefixedURL]);


		return new Response(JSON.stringify({
			shortURL: url.shortURL,
			link: {
				id: url.id,
				shortURL: url.shortURL,
				originalURL: prefixedURL,
				clickCount: url.clickCount,
				createdAt: url.createdAt,
				safeVerdict: url.safeVerdict
			}
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
		
		} catch (error) {
		console.error('Error in shorten API:', error);
		
		// Handle specific error types
		if (error.name === 'PrismaClientKnownRequestError') {
			return new Response(JSON.stringify({ error: 'Database error occurred' }), {
				status: 503,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		if (error.message.includes('timeout')) {
			return new Response(JSON.stringify({ error: 'Request timed out, please try again' }), {
				status: 504,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
