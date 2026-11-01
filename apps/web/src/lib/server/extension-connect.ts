// "Connect to iksi" for the browser extension. The extension opens
// /connect/extension through chrome.identity.launchWebAuthFlow with a
// redirect_uri of https://<extension id>.chromiumapp.org/ and a random state.
// After the user allows it, the page redirects there with a fresh key in the
// URL fragment. Chrome intercepts that redirect and hands the URL to the
// extension, so the key never goes over the network and never reaches a
// server log. Anything not on the allowlist gets an error page, never a
// redirect: this must not become an open redirect or a key leak.

/** The iksi extension in the Chrome Web Store. Permanent. */
export const OFFICIAL_EXTENSION_ID = 'nabbcbgomkkojhmhnglhicbeapheadem';

/** Chrome extension ids: 32 letters a to p. */
const EXTENSION_ID_RE = /^[a-p]{32}$/;
const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** The store id, plus ids of local unpacked builds from EXTENSION_DEV_IDS (comma separated). */
export function allowedExtensionIds(devIds: string | undefined = process.env.EXTENSION_DEV_IDS): string[] {
	const extra = (devIds ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => EXTENSION_ID_RE.test(s) && s !== OFFICIAL_EXTENSION_ID);
	return [OFFICIAL_EXTENSION_ID, ...new Set(extra)];
}

/** True only for the exact string https://<allowed id>.chromiumapp.org/ (no parsing, no normalizing). */
export function isAllowedRedirectUri(uri: unknown, ids: string[]): uri is string {
	if (typeof uri !== 'string') return false;
	return ids.some((id) => uri === `https://${id}.chromiumapp.org/`);
}

export function isValidState(state: unknown): state is string {
	return typeof state === 'string' && STATE_RE.test(state);
}

export type ConnectRequest = { ok: true; redirectUri: string; state: string } | { ok: false };

type Params = { getAll(name: string): unknown[] };

/** Reads redirect_uri and state from a query string or a posted form. Each must appear exactly once. */
export function readConnectRequest(params: Params, ids: string[] = allowedExtensionIds()): ConnectRequest {
	const uris = params.getAll('redirect_uri');
	const states = params.getAll('state');
	if (uris.length !== 1 || states.length !== 1) return { ok: false };
	const [redirectUri] = uris;
	const [state] = states;
	if (!isAllowedRedirectUri(redirectUri, ids) || !isValidState(state)) return { ok: false };
	return { ok: true, redirectUri, state };
}

/**
 * Where the browser goes next. Only call with a redirect_uri that passed
 * readConnectRequest. Keys and states are base64url, so nothing needs escaping.
 */
export function connectRedirect(
	redirectUri: string,
	answer: { key: string; state: string } | { error: string; state: string }
): string {
	const fragment = 'key' in answer ? `key=${answer.key}&state=${answer.state}` : `error=${answer.error}&state=${answer.state}`;
	return `${redirectUri}#${fragment}`;
}

/** No cache may keep the page, and nothing may carry it on as a referrer. */
export const CONNECT_HEADERS = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } as const;

/** Connects allowed per user per hour. */
export const CONNECT_RATE = { requests: 10, windowMs: 3_600_000 };
