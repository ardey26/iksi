import { linkKey, normalizeHost, parseLinkRecord } from './record';

test('www and port normalize to the canonical host', () => {
	expect(normalizeHost('WWW.iksi.app:443')).toBe('iksi.app');
	expect(linkKey('www.iksi.app', 'AbC')).toBe('link:iksi.app:AbC');
});
test('keys keep slug case', () =>
	expect(linkKey('iksi.app', 'abc')).not.toBe(linkKey('iksi.app', 'ABC')));
test('parses a valid record', () => {
	const r = { v: 1, id: 7, destination: 'https://example.com/x', flagged: false, permanent: false };
	expect(parseLinkRecord(r)).toEqual(r);
});
test.each([
	{ v: 2, id: 7, destination: 'https://e.com', flagged: false, permanent: false },
	{ v: 1, id: 7, destination: 'javascript:alert(1)', flagged: false, permanent: false },
	{ v: 1, id: 0, destination: 'https://e.com', flagged: false, permanent: false },
	{ v: 1, id: 7, destination: 'https://e.com' },
	{ v: 1, id: 7, destination: 'https://e.com/' + 'a'.repeat(2048), flagged: false, permanent: false }
])('rejects %o', (r) => expect(parseLinkRecord(r)).toBeNull());

describe('id is Postgres INT4', () => {
	const base = { v: 1, destination: 'https://e.com', flagged: false, permanent: false };
	test('2147483647 is accepted', () =>
		expect(parseLinkRecord({ ...base, id: 2147483647 })).toEqual({ ...base, id: 2147483647 }));
	test('2147483648 is rejected', () =>
		expect(parseLinkRecord({ ...base, id: 2147483648 })).toBeNull());
});
