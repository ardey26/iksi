import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { rateLimit } from '#lib/rateLimit.js';
import { ApiKeyError, connectExtensionKey } from '#lib/server/api-keys.js';
import {
	CONNECT_HEADERS,
	CONNECT_RATE,
	connectRedirect,
	readConnectRequest,
	type ConnectRequest
} from '#lib/server/extension-connect.js';
import { loginUrlFor } from '#lib/server/login-return.js';

// "Connect to iksi" (see lib/server/extension-connect.ts). GET asks; the
// key is only ever made by a POST (SvelteKit's origin check applies), and it
// leaves only in the fragment of the chromiumapp.org redirect.

type Account = { handle: string | null; displayName: string | null; twitterHandle: string | null; googleEmail: string | null };

function accountName(user: Account): string {
	if (user.handle) return `@${user.handle}`;
	return user.displayName?.trim() || (user.twitterHandle ? `@${user.twitterHandle}` : '') || user.googleEmail || 'your account';
}

const invalid = () => error(400, 'This connect link does not work.');

export const load = async ({ url, parent, setHeaders }: RequestEvent & { parent: () => Promise<{ user: Account | null }> }) => {
	setHeaders(CONNECT_HEADERS);
	// Checked before sign-in, and again when sign-in sends the visitor back here.
	const req = readConnectRequest(url.searchParams);
	if (!req.ok) invalid();
	const { user } = await parent();
	if (!user) redirect(303, loginUrlFor(url));
	return { redirectUri: req.redirectUri, state: req.state, account: accountName(user) };
};

async function postedRequest(request: Request): Promise<Extract<ConnectRequest, { ok: true }>> {
	const form = await request.formData().catch(() => null);
	const req: ConnectRequest = form ? readConnectRequest(form) : { ok: false };
	if (!req.ok) invalid();
	return req;
}

/** Back to the extension. The URI passed the allowlist, so `external` is safe here. */
const back = (redirectUri: string, answer: Parameters<typeof connectRedirect>[1]) =>
	redirect(303, connectRedirect(redirectUri, answer), { external: true });

export const actions = {
	allow: async ({ request, cookies, setHeaders }: RequestEvent) => {
		setHeaders(CONNECT_HEADERS);
		const { redirectUri, state } = await postedRequest(request);

		const uid = verifyUserSession(cookies.get('user_session'));
		if (uid === null) {
			const again = new URL('https://www.iksi.app/connect/extension');
			again.searchParams.set('state', state);
			again.searchParams.set('redirect_uri', redirectUri);
			redirect(303, loginUrlFor(again));
		}

		const rl = await rateLimit(`connect-extension:${uid}`, CONNECT_RATE.requests, CONNECT_RATE.windowMs);
		if (!rl.allowed) back(redirectUri, { error: 'rate_limited', state });

		let secret: string;
		try {
			({ secret } = await connectExtensionKey(uid));
		} catch (err) {
			if (err instanceof ApiKeyError && err.code === 'limit') back(redirectUri, { error: 'key_limit', state });
			throw err;
		}
		back(redirectUri, { key: secret, state });
	},

	cancel: async ({ request, setHeaders }: RequestEvent) => {
		setHeaders(CONNECT_HEADERS);
		const { redirectUri, state } = await postedRequest(request);
		back(redirectUri, { error: 'access_denied', state });
	}
};
