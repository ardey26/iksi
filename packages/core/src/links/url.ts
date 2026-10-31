export const MAX_URL_LENGTH = 2048;

// Control characters pass `new URL()` (it strips them) but would make a Location header throw.
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/** Why `value` is not an acceptable destination, or null when it is a clean http(s) URL. */
export function httpUrlError(value: unknown): string | null {
	if (typeof value !== 'string' || value.length === 0) return 'must be an http(s) URL';
	if (value.length > MAX_URL_LENGTH) return `must be at most ${MAX_URL_LENGTH} characters`;
	if (CONTROL_RE.test(value)) return 'must not contain control characters';
	try {
		const { protocol } = new URL(value);
		return protocol === 'http:' || protocol === 'https:' ? null : 'must be an http(s) URL';
	} catch {
		return 'must be an http(s) URL';
	}
}

export function isHttpUrl(value: unknown): value is string {
	return httpUrlError(value) === null;
}
