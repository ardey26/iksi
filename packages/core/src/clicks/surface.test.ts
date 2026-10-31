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
