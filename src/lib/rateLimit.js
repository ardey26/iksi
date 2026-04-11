// Database-backed rate limiter for horizontal scaling
import { prisma } from '$lib/prisma.js';

export async function rateLimit(identifier, maxRequests = 10, windowMs = 60000) {
	const now = new Date();
	const resetAt = new Date(now.getTime() + windowMs);

	try {
		// Use transaction for atomicity
		return await prisma.$transaction(async (tx) => {
			// Get current record
			const existing = await tx.rateLimit.findUnique({
				where: { id: identifier }
			});

			// No record or expired window - create/reset to count=1
			if (!existing || existing.resetAt < now) {
				await tx.rateLimit.upsert({
					where: { id: identifier },
					create: { id: identifier, count: 1, resetAt },
					update: { count: 1, resetAt }
				});
				return { allowed: true, remaining: maxRequests - 1 };
			}

			// Within window and under limit - increment
			if (existing.count < maxRequests) {
				await tx.rateLimit.update({
					where: { id: identifier },
					data: { count: { increment: 1 } }
				});
				return { allowed: true, remaining: maxRequests - existing.count - 1 };
			}

			// Over limit
			return { allowed: false, remaining: 0 };
		});
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
