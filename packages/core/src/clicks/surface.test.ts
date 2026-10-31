import { surfaceFromQuery } from './surface';

const q = (s: string) => new URLSearchParams(s);
const direct = { surface: 'direct', profileId: null, rowId: null };
test('profile with ids', () =>
	expect(surfaceFromQuery(q('s=profile&p=4&r=5'))).toEqual({
		surface: 'profile',
		profileId: 4,
		rowId: 5
	}));
test('profile missing ids is direct', () =>
	expect(surfaceFromQuery(q('s=profile'))).toEqual(direct));
test('profile with non-positive ids is direct', () =>
	expect(surfaceFromQuery(q('s=profile&p=0&r=-2'))).toEqual(direct));
test('profile with non-integer ids is direct', () =>
	expect(surfaceFromQuery(q('s=profile&p=1.5&r=abc'))).toEqual(direct));
test('api', () =>
	expect(surfaceFromQuery(q('s=api'))).toEqual({ surface: 'api', profileId: null, rowId: null }));
test('anything else is direct', () =>
	expect(surfaceFromQuery(q('utm_source=x'))).toEqual(direct));

describe('ids are Postgres INT4', () => {
	test('2147483647 is accepted for both ids', () =>
		expect(surfaceFromQuery(q('s=profile&p=2147483647&r=2147483647'))).toEqual({
			surface: 'profile',
			profileId: 2147483647,
			rowId: 2147483647
		}));
	test.each(['s=profile&p=2147483648&r=5', 's=profile&p=4&r=2147483648', 's=profile&p=3000000000&r=1'])(
		'%s is direct with nulls',
		(query) => expect(surfaceFromQuery(q(query))).toEqual(direct)
	);
});
