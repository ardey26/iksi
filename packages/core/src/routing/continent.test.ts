import { describe, it, expect } from 'vitest';
import { continentOf, CONTINENT_CODES } from './continent';
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
	it('lists no country under two continents', () => {
		const all = Object.values(CONTINENT_CODES).flatMap((s) => s.split(' '));
		expect(new Set(all).size).toBe(all.length);
	});
	it.each([['XK', 'EU'], ['TR', 'AS'], ['RU', 'EU'], ['EG', 'AF'], ['AS', 'OC'], ['NA', 'AF']])(
		'edge code %s -> %s',
		(cc, c) => {
			expect(continentOf(cc)).toBe(c);
		}
	);
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
