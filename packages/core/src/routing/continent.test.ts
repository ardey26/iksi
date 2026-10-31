import { describe, it, expect } from 'vitest';
import { continentOf } from './continent';
import { referrerHost } from './agent';

describe('continentOf', () => {
	it.each([
		['SG', 'AS'], ['PH', 'AS'], ['US', 'NA'], ['BR', 'SA'], ['DE', 'EU'],
		['AU', 'OC'], ['NG', 'AF'], ['AQ', 'AN'], ['sg', 'AS']
	])('%s -> %s', (cc, c) => {
		expect(continentOf(cc)).toBe(c);
	});
	it('unknown or null is null', () => {
		expect(continentOf('XX')).toBeNull();
		expect(continentOf(null)).toBeNull();
	});
	it('covers 249 ISO codes plus XK (Kosovo)', async () => {
		const { COUNTRY_COUNT } = await import('./continent');
		expect(COUNTRY_COUNT).toBe(250);
	});
});

describe('referrerHost', () => {
	it('strips www and path', () => {
		expect(referrerHost('https://www.x.com/a')).toBe('x.com');
	});
	it('null for garbage and null', () => {
		expect(referrerHost('garbage')).toBeNull();
		expect(referrerHost(null)).toBeNull();
	});
});
