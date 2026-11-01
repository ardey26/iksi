// Where sign-in sends the visitor afterwards. A page that needs a session
// (like /connect/extension) sends signed-out visitors to /login?next=<path>.
// The login action keeps `next` in a short-lived cookie across the OAuth
// round trip, and the callback sends the visitor back. `next` is checked on
// the way in and again on the way out: it must be a path on this site.
import type { Cookies } from '@sveltejs/kit';

export const LOGIN_NEXT_COOKIE = 'login_next';
const MAX_LENGTH = 2048;
const BASE = 'https://iksi.invalid';

/** A same-site path (with its query), or null. */
export function safeNext(value: unknown): string | null {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) return null;
	// One leading slash, and no backslashes or control characters anywhere:
	// browsers read "/\evil.com" and "/\tevil" in surprising ways.
	if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
	let url: URL;
	try {
		url = new URL(value, BASE);
	} catch {
		return null;
	}
	if (url.origin !== BASE) return null;
	return url.pathname + url.search;
}

export function loginUrlFor(url: URL): string {
	return `/login?next=${encodeURIComponent(url.pathname + url.search)}`;
}

export function rememberNext(cookies: Cookies, value: unknown, dev: boolean): void {
	const next = safeNext(value);
	if (!next) {
		cookies.delete(LOGIN_NEXT_COOKIE, { path: '/' });
		return;
	}
	cookies.set(LOGIN_NEXT_COOKIE, next, { path: '/', httpOnly: true, secure: !dev, sameSite: 'lax', maxAge: 60 * 10 });
}

/** The remembered path, once: the cookie is cleared whatever it held. */
export function takeNext(cookies: Cookies): string | null {
	const value = cookies.get(LOGIN_NEXT_COOKIE);
	if (value === undefined) return null;
	cookies.delete(LOGIN_NEXT_COOKIE, { path: '/' });
	return safeNext(value);
}
