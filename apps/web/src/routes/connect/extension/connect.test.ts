import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { render, screen, cleanup } from '@testing-library/svelte';

const verifyUserSession = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const connectExtensionKey = vi.hoisted(() => vi.fn());
const page = vi.hoisted(() => ({ url: new URL('https://www.iksi.app/connect/extension'), status: 400, error: { message: '' } }));

vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/api-keys.js', async (orig) => ({
	...(await orig<typeof import('#lib/server/api-keys.js')>()),
	connectExtensionKey
}));
vi.mock('#lib/prisma.js', () => ({ prisma: {} }));
vi.mock('$app/state', () => ({ page }));

import { load, actions } from './+page.server';
import { load as loginLoad, actions as loginActions } from '../../login/+page.server';
import ConnectPage from './+page.svelte';
import ConnectError from './+error.svelte';
import { ApiKeyError } from '#lib/server/api-keys.js';
import { LOGIN_NEXT_COOKIE, takeNext } from '#lib/server/login-return.js';

const ID = 'nabbcbgomkkojhmhnglhicbeapheadem';
const DEV = 'abcdefghijklmnopabcdefghijklmnop';
const REDIRECT = `https://${ID}.chromiumapp.org/`;
const STATE = 'c3RhdGUtdGhhdC1pcy1sb25nLWVub3VnaA';
const SECRET = 'iksi_' + 'K'.repeat(43);
const USER = { id: 42, handle: 'ana', displayName: 'Ana Reyes', twitterHandle: null, googleEmail: 'ana@x.com', profileId: 3, avatarUrl: null };

const connectUrl = (redirect = REDIRECT, state = STATE) =>
	new URL(`https://www.iksi.app/connect/extension?state=${state}&redirect_uri=${encodeURIComponent(redirect)}`);

function jar(initial: Record<string, string> = { user_session: 'cookie' }) {
	const store = new Map(Object.entries(initial));
	return {
		store,
		get: (n: string) => store.get(n),
		set: vi.fn((n: string, v: string) => void store.set(n, v)),
		delete: vi.fn((n: string) => void store.delete(n))
	};
}

async function thrown(fn: () => unknown): Promise<unknown> {
	try {
		await fn();
	} catch (e) {
		return e;
	}
	throw new Error('expected a throw');
}

function runLoad(url: URL, user: unknown = USER) {
	const setHeaders = vi.fn();
	const call = () => load({ url, parent: async () => ({ user }), setHeaders } as never);
	return { setHeaders, call };
}

function runAction(name: 'allow' | 'cancel', fields: Record<string, string | string[]>, cookies = jar()) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, x);
	const request = new Request(`https://www.iksi.app/connect/extension?/${name}`, { method: 'POST', body });
	const setHeaders = vi.fn();
	const call = () => actions[name]({ request, cookies, setHeaders, url: new URL(request.url) } as never);
	return { setHeaders, call, cookies };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
	verifyUserSession.mockReturnValue(42);
	rateLimit.mockResolvedValue({ allowed: true });
	connectExtensionKey.mockResolvedValue({ secret: SECRET, key: { id: 9 } });
});
afterEach(cleanup);

describe('/connect/extension load', () => {
	it('asks a signed-in user, uncached and without a referrer', async () => {
		const { setHeaders, call } = runLoad(connectUrl());
		expect(await call()).toEqual({ redirectUri: REDIRECT, state: STATE, account: '@ana' });
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	});

	it('names the account when there is no handle yet', async () => {
		const { call } = runLoad(connectUrl(), { ...USER, handle: null });
		expect(await call()).toMatchObject({ account: 'Ana Reyes' });
		const bare = runLoad(connectUrl(), { ...USER, handle: null, displayName: null });
		expect(await bare.call()).toMatchObject({ account: 'ana@x.com' });
	});

	it.each([
		['another extension', connectUrl(`https://${DEV}.chromiumapp.org/`)],
		['a lookalike host', connectUrl(`https://${ID}.chromiumapp.org.evil.com/`)],
		['http', connectUrl(`http://${ID}.chromiumapp.org/`)],
		['a path', connectUrl(`${REDIRECT}cb`)],
		['a query', connectUrl(`${REDIRECT}?x=1`)],
		['a short state', connectUrl(REDIRECT, 'abc')],
		['no parameters', new URL('https://www.iksi.app/connect/extension')]
	])('shows an error page, never a redirect, for %s', async (_label, url) => {
		const err = await thrown(runLoad(url).call);
		expect(isRedirect(err)).toBe(false);
		expect(isHttpError(err) && err.status).toBe(400);
	});

	it('refuses a bad request before asking anyone to sign in', async () => {
		const err = await thrown(runLoad(connectUrl('https://evil.com/'), null).call);
		expect(isHttpError(err)).toBe(true);
	});

	it('accepts a dev build listed in EXTENSION_DEV_IDS', async () => {
		vi.stubEnv('EXTENSION_DEV_IDS', DEV);
		const { call } = runLoad(connectUrl(`https://${DEV}.chromiumapp.org/`));
		expect(await call()).toMatchObject({ redirectUri: `https://${DEV}.chromiumapp.org/` });
	});
});

describe('signing in on the way', () => {
	it('goes to sign in and comes back to the same request, checked again', async () => {
		const url = connectUrl();
		const err = await thrown(runLoad(url, null).call);
		expect(isRedirect(err) && err.status).toBe(303);
		const location = (err as { location: string }).location;
		const next = new URL(location, 'https://www.iksi.app').searchParams.get('next');
		expect(location.startsWith('/login?')).toBe(true);
		expect(next).toBe(url.pathname + url.search);

		// The login page hands `next` to its forms.
		expect(loginLoad({ url: new URL(location, 'https://www.iksi.app') } as never)).toEqual({ next });

		// The provider action keeps it for the OAuth round trip.
		vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
		vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://www.iksi.app/auth/google/callback');
		const cookies = jar({});
		const body = new FormData();
		body.set('next', next!);
		const request = new Request('https://www.iksi.app/login?/google', { method: 'POST', body });
		const out = await thrown(() => loginActions.google({ request, cookies } as never));
		expect(isRedirect(out)).toBe(true);
		expect(cookies.store.get(LOGIN_NEXT_COOKIE)).toBe(next);

		// The callback sends the visitor back, and the request is validated again.
		const back = takeNext(cookies as never)!;
		expect(back).toBe(next);
		expect(await runLoad(new URL(back, 'https://www.iksi.app')).call()).toMatchObject({ state: STATE });
	});

	it('does not keep an outside next', async () => {
		const cookies = jar({});
		const body = new FormData();
		body.set('next', 'https://evil.com/');
		vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
		vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://www.iksi.app/auth/google/callback');
		await thrown(() => loginActions.google({ request: new Request('https://www.iksi.app/login?/google', { method: 'POST', body }), cookies } as never));
		expect(cookies.store.has(LOGIN_NEXT_COOKIE)).toBe(false);
	});
});

describe('Allow', () => {
	it('makes an extension key and returns it in the fragment', async () => {
		const { call, setHeaders } = runAction('allow', { redirect_uri: REDIRECT, state: STATE });
		const err = await thrown(call);
		expect(isRedirect(err) && err.status).toBe(303);
		expect((err as { location: string }).location).toBe(`${REDIRECT}#key=${SECRET}&state=${STATE}`);
		expect(connectExtensionKey).toHaveBeenCalledWith(42);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	});

	it('validates the posted request again', async () => {
		for (const fields of [
			{ redirect_uri: 'https://evil.com/', state: STATE },
			{ redirect_uri: `https://${ID}.chromiumapp.org.evil.com/`, state: STATE },
			{ redirect_uri: REDIRECT, state: 'x' },
			{ redirect_uri: [REDIRECT, 'https://evil.com/'], state: STATE }
		]) {
			const err = await thrown(runAction('allow', fields).call);
			expect(isHttpError(err) && err.status).toBe(400);
		}
		expect(connectExtensionKey).not.toHaveBeenCalled();
	});

	it('sends a signed-out post to sign in, without making a key', async () => {
		verifyUserSession.mockReturnValue(null);
		const err = await thrown(runAction('allow', { redirect_uri: REDIRECT, state: STATE }, jar({})).call);
		expect(isRedirect(err) && (err as { location: string }).location).toMatch(/^\/login\?next=%2Fconnect%2Fextension%3F/);
		expect(connectExtensionKey).not.toHaveBeenCalled();
	});

	it('allows 10 connects per hour per user', async () => {
		await thrown(runAction('allow', { redirect_uri: REDIRECT, state: STATE }).call);
		expect(rateLimit).toHaveBeenCalledWith('connect-extension:42', 10, 3_600_000);

		rateLimit.mockResolvedValue({ allowed: false });
		const err = await thrown(runAction('allow', { redirect_uri: REDIRECT, state: STATE }).call);
		expect((err as { location: string }).location).toBe(`${REDIRECT}#error=rate_limited&state=${STATE}`);
		expect(connectExtensionKey).toHaveBeenCalledTimes(1);
	});

	it('says so when the user has too many keys', async () => {
		connectExtensionKey.mockRejectedValue(new ApiKeyError('limit', 'You have 10 keys.'));
		const err = await thrown(runAction('allow', { redirect_uri: REDIRECT, state: STATE }).call);
		expect((err as { location: string }).location).toBe(`${REDIRECT}#error=key_limit&state=${STATE}`);
	});
});

describe('Cancel', () => {
	it('goes back with access_denied and makes nothing', async () => {
		const { call, setHeaders } = runAction('cancel', { redirect_uri: REDIRECT, state: STATE });
		const err = await thrown(call);
		expect(isRedirect(err) && err.status).toBe(303);
		expect((err as { location: string }).location).toBe(`${REDIRECT}#error=access_denied&state=${STATE}`);
		expect(connectExtensionKey).not.toHaveBeenCalled();
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	});

	it('never redirects outside the allowlist', async () => {
		const err = await thrown(runAction('cancel', { redirect_uri: 'https://evil.com/', state: STATE }).call);
		expect(isRedirect(err)).toBe(false);
		expect(isHttpError(err) && err.status).toBe(400);
	});
});

describe('the connect page', () => {
	const data = { redirectUri: REDIRECT, state: STATE, account: '@ana' };

	it('is an interstitial with the brand mark, a Title and one line', () => {
		const { container } = render(ConnectPage, { props: { data } });
		expect(container.querySelectorAll('.paper')).toHaveLength(1);
		expect(container.querySelector('.paper .brand-mark')).not.toBeNull();
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connect the iksi extension?');
		expect(
			screen.getByText('It will shorten links as @ana. You can disconnect it any time in your dashboard.')
		).toBeInTheDocument();
		expect(container.textContent).not.toContain('·');
	});

	it('posts Allow and Cancel as forms carrying the request', () => {
		const { container } = render(ConnectPage, { props: { data } });
		const forms = [...container.querySelectorAll('form')];
		expect(forms.map((f) => [f.getAttribute('method'), f.getAttribute('action')])).toEqual([
			['POST', '?/allow'],
			['POST', '?/cancel']
		]);
		for (const f of forms) {
			expect((f.querySelector('input[name="redirect_uri"]') as HTMLInputElement).value).toBe(REDIRECT);
			expect((f.querySelector('input[name="state"]') as HTMLInputElement).value).toBe(STATE);
		}
		expect(screen.getByRole('button', { name: 'Allow' })).toHaveClass('primary');
		expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('secondary');
	});

	it('explains a bad request', () => {
		render(ConnectError);
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This connect link does not work');
	});
});
