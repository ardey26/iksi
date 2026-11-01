import { describe, it, expect } from 'vitest';
import {
	OFFICIAL_EXTENSION_ID,
	allowedExtensionIds,
	connectRedirect,
	isAllowedRedirectUri,
	isValidState,
	readConnectRequest
} from './extension-connect.js';

const ID = 'nabbcbgomkkojhmhnglhicbeapheadem';
const DEV = 'abcdefghijklmnopabcdefghijklmnop';
const GOOD = `https://${ID}.chromiumapp.org/`;
const STATE = 'Q2hlY2tpbmcgdGhlIHN0YXRlIGlzIGhlcmU';

describe('allowedExtensionIds', () => {
	it('is the store id alone by default', () => {
		expect(OFFICIAL_EXTENSION_ID).toBe(ID);
		expect(allowedExtensionIds(undefined)).toEqual([ID]);
		expect(allowedExtensionIds('')).toEqual([ID]);
	});

	it('adds well-formed dev ids from EXTENSION_DEV_IDS, comma separated', () => {
		expect(allowedExtensionIds(` ${DEV} , ,pppppppppppppppppppppppppppppppp`)).toEqual([
			ID,
			DEV,
			'pppppppppppppppppppppppppppppppp'
		]);
	});

	it('drops anything that is not a Chrome extension id', () => {
		expect(allowedExtensionIds('evil.com,ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP,abc,qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toEqual([ID]);
	});
});

describe('isAllowedRedirectUri', () => {
	it('accepts exactly https://<id>.chromiumapp.org/', () => {
		expect(isAllowedRedirectUri(GOOD, [ID])).toBe(true);
	});

	it('accepts a dev id only when it is allowed', () => {
		const dev = `https://${DEV}.chromiumapp.org/`;
		expect(isAllowedRedirectUri(dev, [ID])).toBe(false);
		expect(isAllowedRedirectUri(dev, allowedExtensionIds(DEV))).toBe(true);
	});

	it.each([
		['another extension', `https://${DEV}.chromiumapp.org/`],
		['http', `http://${ID}.chromiumapp.org/`],
		['no trailing slash', `https://${ID}.chromiumapp.org`],
		['a path', `https://${ID}.chromiumapp.org/cb`],
		['a double slash path', `https://${ID}.chromiumapp.org//evil.com`],
		['a query', `https://${ID}.chromiumapp.org/?x=1`],
		['a fragment', `https://${ID}.chromiumapp.org/#x`],
		['a port', `https://${ID}.chromiumapp.org:443/`],
		['user info', `https://evil@${ID}.chromiumapp.org/`],
		['a lookalike host', `https://${ID}.chromiumapp.org.evil.com/`],
		['a subdomain', `https://x.${ID}.chromiumapp.org/`],
		['a suffix', `https://evil${ID}.chromiumapp.org/`],
		['upper case', `https://${ID.toUpperCase()}.chromiumapp.org/`],
		['an encoded host', `https://${ID}%2Echromiumapp.org/`],
		['whitespace', ` ${GOOD}`],
		['a trailing newline', `${GOOD}\n`],
		['another domain', 'https://evil.com/'],
		['javascript', 'javascript:alert(1)//'],
		['empty', ''],
		['not a string', null]
	])('rejects %s', (_label, uri) => {
		expect(isAllowedRedirectUri(uri as string, [ID])).toBe(false);
	});
});

describe('isValidState', () => {
	it.each([
		['a'.repeat(16), true],
		['a'.repeat(128), true],
		[STATE, true],
		['Ab-_09'.repeat(4), true],
		['a'.repeat(15), false],
		['a'.repeat(129), false],
		['a'.repeat(20) + '=', false],
		['a'.repeat(20) + '+/', false],
		['a'.repeat(20) + '&key=x', false],
		['a'.repeat(20) + ' ', false],
		['', false],
		[null, false]
	])('%j is %s', (s, ok) => expect(isValidState(s as string)).toBe(ok));
});

describe('readConnectRequest', () => {
	const q = (params: Record<string, string>) => new URLSearchParams(params);

	it('reads a valid request', () => {
		expect(readConnectRequest(q({ redirect_uri: GOOD, state: STATE }), [ID])).toEqual({
			ok: true,
			redirectUri: GOOD,
			state: STATE
		});
	});

	it('refuses a redirect_uri outside the allowlist', () => {
		expect(readConnectRequest(q({ redirect_uri: 'https://evil.com/', state: STATE }), [ID])).toEqual({ ok: false });
	});

	it('refuses a bad or missing state', () => {
		expect(readConnectRequest(q({ redirect_uri: GOOD, state: 'short' }), [ID])).toEqual({ ok: false });
		expect(readConnectRequest(q({ redirect_uri: GOOD }), [ID])).toEqual({ ok: false });
	});

	it('refuses repeated parameters', () => {
		const p = q({ redirect_uri: GOOD, state: STATE });
		p.append('redirect_uri', 'https://evil.com/');
		expect(readConnectRequest(p, [ID])).toEqual({ ok: false });
		const s = q({ redirect_uri: GOOD, state: STATE });
		s.append('state', STATE);
		expect(readConnectRequest(s, [ID])).toEqual({ ok: false });
	});

	it('reads form data the same way', () => {
		const f = new FormData();
		f.set('redirect_uri', GOOD);
		f.set('state', STATE);
		expect(readConnectRequest(f, [ID])).toMatchObject({ ok: true });
	});
});

describe('connectRedirect', () => {
	it('puts the answer in the fragment only', () => {
		const url = connectRedirect(GOOD, { key: 'iksi_abc', state: STATE });
		expect(url).toBe(`${GOOD}#key=iksi_abc&state=${STATE}`);
		expect(new URL(url).search).toBe('');
	});

	it('carries an error and the state', () => {
		expect(connectRedirect(GOOD, { error: 'access_denied', state: STATE })).toBe(`${GOOD}#error=access_denied&state=${STATE}`);
	});
});
