// "Connect to iksi": the extension gets its key from iksi without any
// copying. chrome.identity.launchWebAuthFlow opens iksi.app/connect/extension
// in a window; once the user allows it, iksi redirects to this extension's
// https://<id>.chromiumapp.org/ URL with the key in the fragment. Chrome
// stops that redirect before it leaves the browser and hands the URL back
// here. A random state ties the answer to the request.
// Pure logic: chrome.* objects are passed in, so it runs under vitest as is.
import { API_ORIGIN, isKeyFormat } from './shorten.js';

export const CONNECT_URL = `${API_ORIGIN}/connect/extension`;

export const CONNECT_ERRORS = {
  cancelled: 'Connecting was cancelled. Nothing was changed.',
  state_mismatch: 'iksi answered a request this extension did not make, so the answer was ignored. Try again.',
  network: 'Could not reach iksi. Check your connection and try again.',
  rate_limited: 'Too many connects in the last hour. Try again later.',
  key_limit: 'Your account has the most API keys it can hold. Revoke one in your dashboard, then try again.',
  failed: 'Could not connect. Try again.'
};

const fail = (code) => ({ ok: false, code, message: CONNECT_ERRORS[code] });

const SERVER_ERRORS = { access_denied: 'cancelled', rate_limited: 'rate_limited', key_limit: 'key_limit' };

function base64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 32 random bytes, base64url (43 characters). */
export function newState(fill = (a) => crypto.getRandomValues(a)) {
  const bytes = new Uint8Array(32);
  fill(bytes);
  return base64url(bytes);
}

export function buildConnectUrl(state, redirectUri) {
  return `${CONNECT_URL}?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/** Reads the URL iksi redirected to. The state must match exactly, whatever the answer. */
export function readConnectResult(responseUrl, expectedState, redirectUri) {
  if (typeof responseUrl !== 'string' || !responseUrl.startsWith(redirectUri)) return fail('failed');
  const hash = responseUrl.indexOf('#');
  const params = new URLSearchParams(hash === -1 ? '' : responseUrl.slice(hash + 1));

  const states = params.getAll('state');
  if (states.length !== 1 || !expectedState || states[0] !== expectedState) return fail('state_mismatch');

  const error = params.get('error');
  if (error !== null) return fail(SERVER_ERRORS[error] ?? 'failed');

  const key = params.get('key');
  if (!isKeyFormat(key)) return fail('failed');
  return { ok: true, key };
}

/** What a rejected launchWebAuthFlow means to the user. */
export function errorOfLaunch(err) {
  const message = String(err?.message ?? err ?? '');
  if (/did not approve|cancel|closed|denied/i.test(message)) return 'cancelled';
  if (/could not be loaded|net::|network|offline|internet/i.test(message)) return 'network';
  return 'failed';
}

/** Runs the whole flow and saves the key. Never throws. */
export async function connect({ identity, storage, state = newState() }) {
  let redirectUri;
  let responseUrl;
  try {
    redirectUri = identity.getRedirectURL();
    responseUrl = await identity.launchWebAuthFlow({ url: buildConnectUrl(state, redirectUri), interactive: true });
  } catch (err) {
    return fail(errorOfLaunch(err));
  }

  const result = readConnectResult(responseUrl, state, redirectUri);
  if (!result.ok) return result;
  try {
    await storage.set({ apiKey: result.key });
  } catch {
    return fail('failed');
  }
  return result;
}

/** The fallback: a key pasted from the dashboard. */
export async function savePastedKey(raw, storage) {
  const key = String(raw ?? '').trim();
  if (!isKeyFormat(key)) {
    return { ok: false, message: 'That is not an iksi key. Keys start with iksi_ and come from your dashboard.' };
  }
  await storage.set({ apiKey: key });
  return { ok: true, key };
}
