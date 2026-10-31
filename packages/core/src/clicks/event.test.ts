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

describe('ids are Postgres INT4', () => {
	const MAX = 2147483647;
	test('2147483647 is accepted for every id', () => {
		const e = { ...ok, linkId: MAX, profileId: MAX, rowId: MAX };
		expect(parseClickEvent(e)).toEqual(e);
	});
	test.each(['linkId', 'profileId', 'rowId'])('%s of 2147483648 is rejected', (key) =>
		expect(parseClickEvent({ ...ok, [key]: MAX + 1 })).toBeNull()
	);
});
