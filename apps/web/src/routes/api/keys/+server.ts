import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { rateLimit } from '#lib/rateLimit.js';
import { ApiKeyError, createApiKey, listApiKeys, revokeApiKey } from '#lib/server/api-keys.js';

// Dashboard management of API keys. Session only: a key cannot mint or revoke keys.

const signedOut = () => json({ error: 'Not signed in' }, { status: 401 });
const NO_STORE = { 'cache-control': 'no-store' };

export const POST: RequestHandler = async ({ request, cookies }) => {
	const uid = verifyUserSession(cookies.get('user_session'));
	if (uid === null) return signedOut();

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, { status: 400 });

	const rl = await rateLimit(`api-keys:${uid}`, 20, 3_600_000);
	if (!rl.allowed) return json({ error: 'Too many new keys. Try again later.' }, { status: 429 });

	try {
		const { secret } = await createApiKey(uid, body.name);
		return json({ secret, keys: await listApiKeys(uid) }, { status: 201, headers: NO_STORE });
	} catch (err) {
		if (err instanceof ApiKeyError) {
			return json({ error: err.message, code: err.code }, { status: err.code === 'limit' ? 409 : 400 });
		}
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ url, cookies }) => {
	const uid = verifyUserSession(cookies.get('user_session'));
	if (uid === null) return signedOut();

	const raw = url.searchParams.get('id') ?? '';
	if (!/^[1-9]\d{0,8}$/.test(raw)) return json({ error: 'Invalid id' }, { status: 400 });

	if (!(await revokeApiKey(uid, Number(raw)))) return json({ error: 'Not found' }, { status: 404 });
	return json({ keys: await listApiKeys(uid) });
};
