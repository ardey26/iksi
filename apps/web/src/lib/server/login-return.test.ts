import { describe, it, expect, vi } from 'vitest';
import { LOGIN_NEXT_COOKIE, loginUrlFor, rememberNext, safeNext, takeNext } from './login-return.js';

const PATH = '/connect/extension?state=' + 'a'.repeat(43) + '&redirect_uri=https%3A%2F%2Fnabbcbgomkkojhmhnglhicbeapheadem.chromiumapp.org%2F';

function jar(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		store,
		get: (n: string) => store.get(n),
		set: vi.fn((n: string, v: string) => void store.set(n, v)),
		delete: vi.fn((n: string) => void store.delete(n))
	};
}

describe('safeNext', () => {
	it('keeps a path on this site, with its query', () => {
		expect(safeNext(PATH)).toBe(PATH);
		expect(safeNext('/dashboard')).toBe('/dashboard');
	});

	it.each([
		['//evil.com/x'],
		['/\\evil.com'],
		['\\\\evil.com'],
		['https://evil.com/'],
		['javascript:alert(1)'],
		['dashboard'],
		['/\tevil'],
		['/a\nb'],
		['/' + 'a'.repeat(2048)],
		[''],
		[null],
		[42]
	])('refuses %j', (v) => expect(safeNext(v)).toBeNull());

	it('drops a fragment', () => {
		expect(safeNext('/dashboard#x')).toBe('/dashboard');
	});
});

describe('loginUrlFor', () => {
	it('sends the visitor to sign in and back to the same page', () => {
		const url = new URL('https://www.iksi.app' + PATH);
		const login = loginUrlFor(url);
		expect(login.startsWith('/login?next=')).toBe(true);
		expect(new URL(login, 'https://www.iksi.app').searchParams.get('next')).toBe(PATH);
	});
});

describe('rememberNext and takeNext', () => {
	it('keeps a safe next across the OAuth round trip, once', () => {
		const cookies = jar();
		rememberNext(cookies as never, PATH, false);
		expect(cookies.set).toHaveBeenCalledWith(LOGIN_NEXT_COOKIE, PATH, expect.objectContaining({ httpOnly: true, path: '/', secure: true }));
		expect(takeNext(cookies as never)).toBe(PATH);
		expect(cookies.delete).toHaveBeenCalledWith(LOGIN_NEXT_COOKIE, { path: '/' });
		expect(takeNext(cookies as never)).toBeNull();
	});

	it('forgets an unsafe next instead of storing it', () => {
		const cookies = jar({ [LOGIN_NEXT_COOKIE]: '/old' });
		rememberNext(cookies as never, '//evil.com', false);
		expect(cookies.set).not.toHaveBeenCalled();
		expect(cookies.store.has(LOGIN_NEXT_COOKIE)).toBe(false);
	});

	it('checks the cookie again when it comes back', () => {
		expect(takeNext(jar({ [LOGIN_NEXT_COOKIE]: '//evil.com' }) as never)).toBeNull();
	});
});
