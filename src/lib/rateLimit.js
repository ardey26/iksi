// Simple in-memory rate limiter
const rateLimitStore = new Map();

export function rateLimit(identifier, maxRequests = 10, windowMs = 60000) {
	const now = Date.now();
	const key = identifier;
	
	if (!rateLimitStore.has(key)) {
		rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
		return { allowed: true, remaining: maxRequests - 1 };
	}
	
	const limit = rateLimitStore.get(key);
	
	if (now > limit.resetTime) {
		// Reset the window
		rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
		return { allowed: true, remaining: maxRequests - 1 };
	}
	
	if (limit.count >= maxRequests) {
		return { allowed: false, remaining: 0 };
	}
	
	limit.count++;
	return { allowed: true, remaining: maxRequests - limit.count };
}

// Clean up old entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, value] of rateLimitStore.entries()) {
		if (now > value.resetTime) {
			rateLimitStore.delete(key);
		}
	}
}, 60000); // Clean up every minute
