import { parseClickEvent } from './event';

const ok = {
	v: 1,
	linkId: 3,
	ts: 1700000000000,
	country: 'SG',
	userAgent: 'UA',
	referer: null,
	surface: 'profile',
	profileId: 4,
	rowId: 5
};
test('parses a valid event', () => expect(parseClickEvent(ok)).toEqual(ok));
test.each([
	{ ...ok, v: 2 },
	{ ...ok, linkId: -1 },
	{ ...ok, surface: 'email' },
	{ ...ok, ts: 'now' },
	{ ...ok, country: 'SGP' },
	{ ...ok, userAgent: 'x'.repeat(2049) },
	null,
	'x'
])('rejects %o', (e) => expect(parseClickEvent(e)).toBeNull());
