import { prisma } from '#lib/prisma.js';
import { rateLimit } from '#lib/rateLimit.js';
import { RATE_LIMIT, SHORT_URL } from '#lib/config.js';
import { addPrefix, isValidURLServer, isValidAlias } from '#lib/utils/urlValidation.js';
import { createURLHash } from '#lib/utils/urlHash.js';
import { encodeURL } from '#lib/server/crypto.js';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { randomBytes } from 'crypto';
import { classifyPath } from '@iksi/core';
import { clientOf } from '#lib/server/client.js';
import { settleVerdictInBackground } from '#lib/server/link-verdict.js';
import { FLAGGED_VERDICTS } from '#lib/server/link-record.js';
import { API_KEY_RATE, authenticateApiKey, readBearer } from '#lib/server/api-keys.js';
import { extensionPreflight, withExtensionCors } from '#lib/server/extension-cors.js';

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


const jsonError = (status, error, extra = {}) =>
	new Response(JSON.stringify({ error, ...extra }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

/**
 * Who is shortening: an API key's owner, the signed-in user, or nobody.
 * A request that sends an Authorization header is judged by that header
 * alone. A bad or revoked key is refused, never treated as anonymous, and the
 * session cookie is ignored.
 */
async function identify(request, cookies) {
	const bearer = readBearer(request.headers.get('authorization'));
	if (bearer.kind === 'none') return { uid: verifyUserSession(cookies.get('user_session')) };

	const invalid = { response: jsonError(401, 'Invalid API key', { code: 'invalid_key' }) };
	if (bearer.kind === 'bad') return invalid;
	const key = await authenticateApiKey(bearer.key);
	if (!key) return invalid;

	const limit = await rateLimit(`apikey:${key.id}`, API_KEY_RATE.requests, API_KEY_RATE.windowMs);
	if (!limit.allowed) return { response: jsonError(429, 'Too many requests for this key. Please wait a minute.') };
	return { uid: key.userId };
}

export const OPTIONS = async ({ request }) => extensionPreflight(request);

export const POST = async (event) => withExtensionCors(event.request, await shorten(event));

const shorten = async (event) => {
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

		const who = await identify(request, cookies);
		if (who.response) return who.response;
		const uid = who.uid;

		const { longURL, customURL } = await request.json();

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
		// A new slug for a URL whose existing row is flagged starts flagged, so it
		// never redirects before its own check runs. Only a completed check clears it.
		let inheritedVerdict = null;
		const inheritFlag = (row) => {
			if (row?.safeVerdict != null && FLAGGED_VERDICTS.includes(row.safeVerdict)) inheritedVerdict = row.safeVerdict;
		};

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

			// A name the app already routes (dashboard, api, login...) would be
			// created but could never resolve, so refuse it up front.
			if (classifyPath(`/${trimmedCustomURL}`).kind !== 'slug') {
				return new Response(JSON.stringify({ error: 'that name is reserved, pick another one' }), {
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
				inheritFlag(isShortened);
			}
		}

		const encodedURL = encodeURL(prefixedURL);
		const insert = (urlHash) =>
			prisma.longURL.create({
				data: {
					originalURL: encodedURL,
					urlHash,
					shortURL: shortURL,
					userId: uid,
					...(inheritedVerdict ? { safeVerdict: inheritedVerdict } : {})
				},
				select: {
					id: true,
					shortURL: true,
					clickCount: true,
					createdAt: true,
					safeVerdict: true,
					settingsVersion: true
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
			inheritFlag(existing);
			url = await insert(null);
		}

		// Fire safe-browsing async; failures never block shorten response
		settleVerdictInBackground(url.shortURL, [prefixedURL], url.settingsVersion);


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
