import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CONNECT_ERRORS,
  CONNECT_URL,
  buildConnectUrl,
  connect,
  errorOfLaunch,
  newState,
  readConnectResult,
  savePastedKey
} from '../src/connect.js';

const KEY = 'iksi_' + 'Ab3-_'.repeat(8) + 'xyz';
const REDIRECT = 'https://nabbcbgomkkojhmhnglhicbeapheadem.chromiumapp.org/';
const STATE = 'c3RhdGUtdGhhdC1pcy1sb25nLWVub3VnaC1mb3ItdXM';

function fakeChrome({ launch = async () => `${REDIRECT}#key=${KEY}&state=${STATE}` } = {}) {
  const saved = {};
  return {
    saved,
    identity: { getRedirectURL: vi.fn(() => REDIRECT), launchWebAuthFlow: vi.fn(launch) },
    storage: { set: vi.fn(async (o) => Object.assign(saved, o)) }
  };
}

describe('newState', () => {
  it('is 32 random bytes in base64url', () => {
    const fill = vi.fn((a) => a.fill(255));
    const s = newState(fill);
    expect(fill.mock.calls[0][0]).toHaveLength(32);
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(s).toBe('_'.repeat(42) + '8');
  });

  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 50 }, () => newState()));
    expect(seen.size).toBe(50);
  });
});

describe('buildConnectUrl', () => {
  it('opens the connect page with the state and the extension redirect', () => {
    const url = new URL(buildConnectUrl(STATE, REDIRECT));
    expect(CONNECT_URL).toBe('https://www.iksi.app/connect/extension');
    expect(url.origin + url.pathname).toBe(CONNECT_URL);
    expect(url.searchParams.get('state')).toBe(STATE);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(buildConnectUrl(STATE, REDIRECT)).toContain(`redirect_uri=${encodeURIComponent(REDIRECT)}`);
  });
});

describe('readConnectResult', () => {
  const read = (fragment, state = STATE) => readConnectResult(`${REDIRECT}#${fragment}`, state, REDIRECT);

  it('takes the key when the state matches', () => {
    expect(read(`key=${KEY}&state=${STATE}`)).toEqual({ ok: true, key: KEY });
  });

  it.each([
    ['another state', `key=${KEY}&state=${STATE}x`],
    ['a missing state', `key=${KEY}`],
    ['an empty state', `key=${KEY}&state=`],
    ['two states', `key=${KEY}&state=x&state=${STATE}`],
    ['a state of different case', `key=${KEY}&state=${STATE.toUpperCase()}`]
  ])('rejects %s', (_l, fragment) => {
    expect(read(fragment)).toMatchObject({ ok: false, code: 'state_mismatch' });
  });

  it('rejects even an error answer whose state does not match', () => {
    expect(read('error=access_denied&state=nope')).toMatchObject({ ok: false, code: 'state_mismatch' });
  });

  it.each([
    ['access_denied', 'cancelled'],
    ['rate_limited', 'rate_limited'],
    ['key_limit', 'key_limit'],
    ['something_else', 'failed']
  ])('maps error=%s to %s', (error, code) => {
    expect(read(`error=${error}&state=${STATE}`)).toMatchObject({ ok: false, code });
  });

  it('rejects a malformed key', () => {
    expect(read(`key=iksi_short&state=${STATE}`)).toMatchObject({ ok: false, code: 'failed' });
  });

  it('ignores a key in the query instead of the fragment', () => {
    expect(readConnectResult(`${REDIRECT}?key=${KEY}&state=${STATE}`, STATE, REDIRECT)).toMatchObject({ ok: false });
  });

  it('rejects an answer that did not come back to this extension', () => {
    expect(readConnectResult(`https://evil.com/#key=${KEY}&state=${STATE}`, STATE, REDIRECT)).toMatchObject({ ok: false, code: 'failed' });
  });

  it('copes with nothing', () => {
    expect(readConnectResult(undefined, STATE, REDIRECT)).toMatchObject({ ok: false, code: 'failed' });
  });
});

describe('errorOfLaunch', () => {
  it.each([
    ['The user did not approve access.', 'cancelled'],
    ['User cancelled or denied access.', 'cancelled'],
    ['Authorization page could not be loaded.', 'network'],
    ['net::ERR_INTERNET_DISCONNECTED', 'network'],
    ['Something odd', 'failed']
  ])('%s → %s', (message, code) => expect(errorOfLaunch(new Error(message))).toBe(code));
});

describe('connect', () => {
  it('runs the web auth flow and stores the key on success', async () => {
    const c = fakeChrome();
    const r = await connect({ identity: c.identity, storage: c.storage, state: STATE });
    expect(r).toEqual({ ok: true, key: KEY });
    expect(c.saved).toEqual({ apiKey: KEY });
    const [{ url, interactive }] = c.identity.launchWebAuthFlow.mock.calls[0];
    expect(interactive).toBe(true);
    expect(url).toBe(buildConnectUrl(STATE, REDIRECT));
  });

  it('makes a fresh state each time when none is given', async () => {
    const c = fakeChrome({ launch: async ({ url }) => `${REDIRECT}#key=${KEY}&state=${new URL(url).searchParams.get('state')}` });
    expect(await connect({ identity: c.identity, storage: c.storage })).toMatchObject({ ok: true });
    await connect({ identity: c.identity, storage: c.storage });
    const states = c.identity.launchWebAuthFlow.mock.calls.map(([{ url }]) => new URL(url).searchParams.get('state'));
    expect(states[0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(states[0]).not.toBe(states[1]);
  });

  it('stores nothing when the state does not match', async () => {
    const c = fakeChrome({ launch: async () => `${REDIRECT}#key=${KEY}&state=forged-state-0000000` });
    expect(await connect({ identity: c.identity, storage: c.storage, state: STATE })).toEqual({
      ok: false,
      code: 'state_mismatch',
      message: CONNECT_ERRORS.state_mismatch
    });
    expect(c.storage.set).not.toHaveBeenCalled();
  });

  it('reports a closed window as cancelled', async () => {
    const c = fakeChrome({ launch: async () => Promise.reject(new Error('The user did not approve access.')) });
    expect(await connect({ identity: c.identity, storage: c.storage, state: STATE })).toMatchObject({ ok: false, code: 'cancelled' });
    expect(c.storage.set).not.toHaveBeenCalled();
  });

  it('reports Cancel on the page as cancelled', async () => {
    const c = fakeChrome({ launch: async () => `${REDIRECT}#error=access_denied&state=${STATE}` });
    expect(await connect({ identity: c.identity, storage: c.storage, state: STATE })).toMatchObject({ ok: false, code: 'cancelled' });
  });

  it('reports a page that would not load as a network error', async () => {
    const c = fakeChrome({ launch: async () => Promise.reject(new Error('Authorization page could not be loaded.')) });
    expect(await connect({ identity: c.identity, storage: c.storage, state: STATE })).toMatchObject({ ok: false, code: 'network' });
  });

  it('never throws, even when storage fails', async () => {
    const c = fakeChrome();
    c.storage.set.mockRejectedValue(new Error('QUOTA_BYTES'));
    expect(await connect({ identity: c.identity, storage: c.storage, state: STATE })).toMatchObject({ ok: false, code: 'failed' });
  });

  it('every error has a plain message without the key', () => {
    for (const code of ['cancelled', 'state_mismatch', 'network', 'rate_limited', 'key_limit', 'failed']) {
      expect(CONNECT_ERRORS[code]).toMatch(/^([A-Z]|iksi ).*\.$/);
      expect(CONNECT_ERRORS[code]).not.toContain('·');
    }
  });
});

describe('savePastedKey (the fallback paste flow)', () => {
  it('saves a well-formed key, trimmed', async () => {
    const storage = { set: vi.fn(async () => {}) };
    expect(await savePastedKey(`  ${KEY}\n`, storage)).toEqual({ ok: true, key: KEY });
    expect(storage.set).toHaveBeenCalledWith({ apiKey: KEY });
  });

  it.each(['', 'iksi_nope', 'sk_live_' + 'a'.repeat(43)])('refuses %j without saving', async (raw) => {
    const storage = { set: vi.fn() };
    expect(await savePastedKey(raw, storage)).toMatchObject({ ok: false });
    expect(storage.set).not.toHaveBeenCalled();
  });
});

describe('manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  it('is version 1.1.0 in both files', () => {
    expect(manifest.version).toBe('1.1.0');
    expect(pkg.version).toBe('1.1.0');
  });

  it('asks for identity, and nothing beyond what the listing justifies', () => {
    expect(manifest.permissions.sort()).toEqual(
      ['activeTab', 'clipboardWrite', 'contextMenus', 'identity', 'notifications', 'offscreen', 'storage'].sort()
    );
    expect(manifest.host_permissions).toEqual(['https://www.iksi.app/*']);
  });
});
