import {
	decideLink,
	LINK_RECORD_VERSION,
	linkKey,
	normalizeHost,
	parseLinkRecord,
	type LinkRecord
} from './record';

test('www and port normalize to the canonical host', () => {
	expect(normalizeHost('WWW.iksi.app:443')).toBe('iksi.app');
	expect(linkKey('www.iksi.app', 'AbC')).toBe('link:iksi.app:AbC');
});
test('keys keep slug case', () =>
	expect(linkKey('iksi.app', 'abc')).not.toBe(linkKey('iksi.app', 'ABC')));
test('parses a valid record', () => {
	const r = { v: 2, id: 7, destination: 'https://example.com/x', flagged: false, permanent: false };
	expect(parseLinkRecord(r)).toEqual(r);
});
test.each([
	{ v: 3, id: 7, destination: 'https://e.com', flagged: false, permanent: false },
	{ v: 0, id: 7, destination: 'https://e.com', flagged: false, permanent: false },
	{ v: '2', id: 7, destination: 'https://e.com', flagged: false, permanent: false },
	{ id: 7, destination: 'https://e.com', flagged: false, permanent: false },
	{ v: 2, id: 7, destination: 'javascript:alert(1)', flagged: false, permanent: false },
	{ v: 2, id: 0, destination: 'https://e.com', flagged: false, permanent: false },
	{ v: 2, id: 7, destination: 'https://e.com' },
	{ v: 2, id: 7, destination: 'https://e.com/' + 'a'.repeat(2048), flagged: false, permanent: false },
	{ v: 2, id: 7, destination: 'https://e.com/x\ny', flagged: false, permanent: false },
	{ v: 2, id: 7, destination: 'https://e.com/\tx', flagged: false, permanent: false }
])('rejects %o', (r) => expect(parseLinkRecord(r)).toBeNull());

describe('id is Postgres INT4', () => {
	const base = { v: 2, destination: 'https://e.com', flagged: false, permanent: false };
	test('2147483647 is accepted', () =>
		expect(parseLinkRecord({ ...base, id: 2147483647 })).toEqual({ ...base, id: 2147483647 }));
	test('2147483648 is rejected', () =>
		expect(parseLinkRecord({ ...base, id: 2147483648 })).toBeNull());
});

describe('record versions', () => {
	const v1 = { v: 1, id: 7, destination: 'https://e.com', flagged: false, permanent: false };
	const rule = { id: 'rule0001', when: { devices: ['mobile'] }, destination: 'https://m.e.com' };

	test('a v1 (P2-era) record parses with empty settings', () => {
		const parsed = parseLinkRecord(v1);
		expect(parsed).toEqual(v1);
		expect(decideLink(parsed as LinkRecord, Date.now())).toBe('redirect');
	});
	test.each([
		{ rules: [rule] },
		{ rules: [] },
		{ expiresAt: null },
		{ expired: false },
		{ protected: true }
	])('a v1 record carrying a settings key %o is rejected', (extra) =>
		expect(parseLinkRecord({ ...v1, ...extra })).toBeNull());
	test('a v2 record with every setting round-trips through JSON', () => {
		const full = {
			v: 2,
			id: 7,
			destination: 'https://e.com',
			flagged: false,
			permanent: true,
			rules: [rule],
			expiresAt: 1_700_000_000_000,
			expired: false,
			protected: true
		};
		expect(parseLinkRecord(JSON.parse(JSON.stringify(full)))).toEqual(full);
	});
	test('LINK_RECORD_VERSION is 2', () => expect(LINK_RECORD_VERSION).toBe(2));
});

describe('P6 settings fields', () => {
	const base = { v: 2, id: 7, destination: 'https://e.com', flagged: false, permanent: false };
	const rule = { id: 'rule0001', when: { devices: ['mobile'] }, destination: 'https://m.e.com' };

	test('a v2 record without settings gains no fields', () =>
		expect(parseLinkRecord(base)).toEqual(base));
	test('accepts valid rules, expiresAt, expired and protected', () => {
		const full = { ...base, rules: [rule], expiresAt: 1_700_000_000_000, expired: false, protected: true };
		expect(parseLinkRecord(full)).toEqual(full);
	});
	test('null expiresAt is accepted', () =>
		expect(parseLinkRecord({ ...base, expiresAt: null })).toEqual({ ...base, expiresAt: null }));
	test('rules that fail parseRules become []', () =>
		expect(parseLinkRecord({ ...base, rules: [{ nope: 1 }] })).toEqual({ ...base, rules: [] }));
	test('non-array rules become []', () =>
		expect(parseLinkRecord({ ...base, rules: 'x' })).toEqual({ ...base, rules: [] }));
	test.each([
		{ expiresAt: 'soon' },
		{ expiresAt: NaN },
		{ expiresAt: Infinity },
		{ expired: 'yes' },
		{ protected: 1 }
	])('rejects bad field %o', (extra) =>
		expect(parseLinkRecord({ ...base, ...extra })).toBeNull());
});

describe('decideLink', () => {
	const base: LinkRecord = { v: 2, id: 7, destination: 'https://e.com', flagged: false, permanent: false };
	const now = 1_700_000_000_000;
	test('P2-shaped record redirects', () => expect(decideLink(base, now)).toBe('redirect'));
	test('flagged beats expired and protected', () =>
		expect(decideLink({ ...base, flagged: true, expired: true, protected: true }, now)).toBe('flagged'));
	test('expired beats protected', () =>
		expect(decideLink({ ...base, expired: true, protected: true }, now)).toBe('expired'));
	test('expiresAt in the past is expired', () =>
		expect(decideLink({ ...base, expiresAt: now - 1 }, now)).toBe('expired'));
	test('expiresAt equal to now is expired', () =>
		expect(decideLink({ ...base, expiresAt: now }, now)).toBe('expired'));
	test('expiresAt in the future redirects', () =>
		expect(decideLink({ ...base, expiresAt: now + 1 }, now)).toBe('redirect'));
	test('protected', () => expect(decideLink({ ...base, protected: true }, now)).toBe('protected'));
});
