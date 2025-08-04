import { prisma } from '../../../lib/prisma.js';
import { rateLimit } from '../../../lib/rateLimit.js';
import { RATE_LIMIT, SHORT_URL } from '../../../lib/config.js';
import { randomBytes } from 'crypto';

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

const addPrefix = (url) => {
	
	url = url.trim();
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}
	return 'https://' + url;
};

const isValidURL = (prefixedURL) => {
	try {
		const url = new URL(prefixedURL);
		// More comprehensive validation
		return ['http:', 'https:'].includes(url.protocol) && 
		       url.hostname.length > 0 && 
		       url.hostname.includes('.') &&
		       !url.hostname.includes('localhost') && 
		       !url.hostname.includes('127.0.0.1') &&
		       !url.hostname.includes('0.0.0.0') &&
		       url.hostname.split('.').length >= 2;
	} catch {
		return false;
	}
};

const isValidAlias = (customURL) => {
	const pattern = /^[a-zA-Z0-9-_]+$/;

	return pattern.test(customURL);
};


export const POST = async ({ request, getClientAddress }) => {
	try {
		// Rate limiting
		const clientIP = getClientAddress();
		const rateLimitResult = rateLimit(clientIP, RATE_LIMIT.requests, RATE_LIMIT.windowMs);
		
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

		const prefixedURL = addPrefix(longURL.trim());

		if (!isValidURL(prefixedURL)) {
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
			const isShortened = await prisma.longURL.findFirst({
				where: {
					originalURL: prefixedURL
				},
				select: {
					shortURL: true
				}
			});

			if (isShortened) {
				return new Response(JSON.stringify({ shortURL: isShortened.shortURL }), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

			shortURL = await generateShortURL();
		}

		const url = await prisma.longURL.create({
			data: {
				originalURL: prefixedURL,
				shortURL: shortURL
			},
			select: {
				shortURL: true
			}
		});
		
		return new Response(JSON.stringify({ shortURL: url.shortURL }), {
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
