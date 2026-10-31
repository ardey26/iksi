/**
 * Signs visitor-identity headers on pass-through. Must match EDGE_HEADERS in
 * apps/web/src/lib/server/client.ts. The origin's internal endpoints do NOT
 * trust it: the Worker sets it on every forwarded visitor request.
 */
export const EDGE_SECRET_HEADER = 'x-iksi-edge';

/**
 * Carries EDGE_SECRET on the Worker's own calls to the origin's /internal/*
 * endpoints, the only header those endpoints trust. Never forwarded from a
 * visitor. Must match INTERNAL_HEADER in apps/web/src/lib/server/edge-auth.ts.
 */
export const INTERNAL_HEADER = 'x-iksi-internal';

/** Constant-time: both sides are hashed to equal length, then compared with timingSafeEqual. */
export async function secretMatches(
	given: string | null,
	expected: string | undefined
): Promise<boolean> {
	if (!expected || !given) return false;
	const digest = async (value: string) =>
		new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
	const [a, b] = await Promise.all([digest(given), digest(expected)]);
	return crypto.subtle.timingSafeEqual(a, b);
}

/** Headers for a Worker-to-origin internal call. */
export function internalHeaders(secret: string | undefined): Headers {
	const headers = new Headers();
	if (secret) headers.set(INTERNAL_HEADER, secret);
	return headers;
}
