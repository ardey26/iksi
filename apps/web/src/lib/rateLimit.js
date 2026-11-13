// Database-backed rate limiter for horizontal scaling
import { prisma } from '#lib/prisma.js';

/**
 * Rate limits are off under `vite dev`, so local work never trips them (or
 * needs a database for them). On everywhere else: a production build has
 * DEV false, and tests run in MODE 'test' so the limits stay under test.
 */
export function rateLimitsOff(env = import.meta.env) {
	return env.DEV === true && env.MODE !== 'test';
}

export async function rateLimit(identifier, maxRequests = 10, windowMs = 60000) {
	if (rateLimitsOff()) return { allowed: true, remaining: maxRequests };
	const now = new Date();
	const resetAt = new Date(now.getTime() + windowMs);

	try {
		// Try to upsert the rate limit record
		const record = await prisma.rateLimit.upsert({
			where: { id: identifier },
			create: {
				id: identifier,
				count: 1,
				resetAt: resetAt
			},
			update: {
				// Increment count if within window, reset if expired
				count: {
					increment: 1
				}
			}
		});

		// Check if window has expired
		if (record.resetAt < now) {
			// Reset the window
			await prisma.rateLimit.update({
				where: { id: identifier },
				data: {
					count: 1,
					resetAt: resetAt
				}
			});
			return { allowed: true, remaining: maxRequests - 1 };
		}

		// Check if over limit
		if (record.count > maxRequests) {
			return { allowed: false, remaining: 0 };
		}

		return { allowed: true, remaining: maxRequests - record.count };
	} catch (error) {
		// On database error, deny the request (fail-closed)
		console.error('Rate limit error:', error);
		return { allowed: false, remaining: 0 };
	}
}

/** How long a counter is kept after its window ends before the daily cleanup deletes it. */
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes rate-limit counters (RateLimit and HandleClaimRateLimit) whose
 * window ended more than RATE_LIMIT_RETENTION_MS ago. Run daily by the
 * expire-secrets cron. An expired counter already acts as no counter, so this
 * never changes a limit; it only stops the rows piling up. Throws on a
 * database error so the cron run shows as failed.
 */
export async function cleanupRateLimits(now = Date.now()) {
	const before = new Date(now - RATE_LIMIT_RETENTION_MS);
	const [rateLimits, handleClaims] = await Promise.all([
		prisma.rateLimit.deleteMany({ where: { resetAt: { lt: before } } }),
		prisma.handleClaimRateLimit.deleteMany({ where: { resetAt: { lt: before } } })
	]);
	return { rateLimits: rateLimits.count, handleClaims: handleClaims.count };
}
