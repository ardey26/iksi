// Database-backed rate limiter for horizontal scaling
import { prisma } from '$lib/prisma.js';

export async function rateLimit(identifier, maxRequests = 10, windowMs = 60000) {
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

// Cleanup old rate limit entries (run periodically via cron or on cold start)
export async function cleanupRateLimits() {
	try {
		await prisma.rateLimit.deleteMany({
			where: {
				resetAt: { lt: new Date() }
			}
		});
	} catch (error) {
		console.error('Rate limit cleanup error:', error);
	}
}
