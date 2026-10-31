import { describe, expect, it } from 'vitest';
import { MAX_RULES, matches, parseRules, resolveDestination, type Rule } from './rules';
import type { RequestContext } from './rules';

const DEF = 'https://default.example/';
const ctx = (o: Partial<RequestContext> = {}): RequestContext => ({
	country: 'SG',
	continent: 'AS',
	device: 'desktop',
	os: 'other',
	referrerHost: null,
	now: Date.UTC(2026, 0, 7, 12, 0),
	...o
});
const rule = (id: string, when: Rule['when'], destination = `https://${id}.example/`): Rule => ({
	id,
	when,
	destination
});
const ok = (input: unknown) => {
	const r = parseRules(input);
	if (!r.ok) throw new Error(r.error);
	return r.rules;
};
const err = (input: unknown) => {
	const r = parseRules(input);
	if (r.ok) throw new Error('expected rejection');
	return r.error;
};

describe('resolveDestination', () => {
	it('returns the default with no rules', () => {
		expect(resolveDestination(DEF, [], ctx(), () => 0)).toEqual({ destination: DEF, ruleId: null });
	});
	it('first match wins', () => {
		const rules = [rule('a', { countries: ['SG'] }), rule('b', { continents: ['AS'] })];
		expect(resolveDestination(DEF, rules, ctx(), () => 0).ruleId).toBe('a');
	});
	it('falls through to the default when nothing matches', () => {
		expect(resolveDestination(DEF, [rule('a', { countries: ['US'] })], ctx(), () => 0)).toEqual({
			destination: DEF,
			ruleId: null
		});
	});
	it('all-null context resolves to the default', () => {
		const c = ctx({ country: null, continent: null, referrerHost: null });
		const rules = [
			rule('a', { countries: ['SG'] }),
			rule('b', { continents: ['AS'] }),
			rule('c', { referrerHosts: ['x.com'] })
		];
		expect(resolveDestination(DEF, rules, c, () => 0)).toEqual({ destination: DEF, ruleId: null });
	});
	it('splits 70/30 exactly across the random range', () => {
		const rules: Rule[] = [
			{
				id: 's',
				when: {},
				split: [
					{ destination: 'https://a.example/', weight: 70 },
					{ destination: 'https://b.example/', weight: 30 }
				]
			}
		];
		const counts: Record<string, number> = {};
		for (let i = 0; i < 10000; i++) {
			const d = resolveDestination(DEF, rules, ctx(), () => i / 10000).destination;
			counts[d] = (counts[d] ?? 0) + 1;
		}
		expect(counts).toEqual({ 'https://a.example/': 7000, 'https://b.example/': 3000 });
		expect(resolveDestination(DEF, rules, ctx(), () => 0).destination).toBe('https://a.example/');
		expect(resolveDestination(DEF, rules, ctx(), () => 0.999999).destination).toBe(
			'https://b.example/'
		);
		expect(resolveDestination(DEF, rules, ctx(), () => 0.999999).ruleId).toBe('s');
	});
});

describe('matches', () => {
	it('empty when matches everything', () => {
		expect(matches({}, ctx({ country: null, continent: null }))).toBe(true);
	});
	it('ANDs conditions', () => {
		const w = { countries: ['SG'], devices: ['mobile' as const] };
		expect(matches(w, ctx({ device: 'mobile' }))).toBe(true);
		expect(matches(w, ctx({ device: 'desktop' }))).toBe(false);
	});
	it('bot never matches devices but matches rules without one', () => {
		expect(matches({ devices: ['desktop'] }, ctx({ device: 'bot' }))).toBe(false);
		expect(matches({ countries: ['SG'] }, ctx({ device: 'bot' }))).toBe(true);
	});
	it('matches os', () => {
		expect(matches({ os: ['ios'] }, ctx({ os: 'ios' }))).toBe(true);
		expect(matches({ os: ['ios'] }, ctx({ os: 'android' }))).toBe(false);
	});
	it('matches referrer hosts exactly or by subdomain, ignoring www', () => {
		const w = { referrerHosts: ['x.com'] };
		expect(matches(w, ctx({ referrerHost: 'x.com' }))).toBe(true);
		expect(matches(w, ctx({ referrerHost: 'm.x.com' }))).toBe(true);
		expect(matches(w, ctx({ referrerHost: 'notx.com' }))).toBe(false);
		expect(matches(w, ctx({ referrerHost: null }))).toBe(false);
		expect(matches({ referrerHosts: ['www.x.com'] }, ctx({ referrerHost: 'x.com' }))).toBe(true);
		expect(matches(w, ctx({ referrerHost: 'www.x.com' }))).toBe(true);
	});
	it('matches business hours in Manila', () => {
		const w = { time: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', tz: 'Asia/Manila' } };
		// Manila is UTC+8. 2026-01-07 is a Wednesday, 2026-01-10 a Saturday.
		const at = (d: number, h: number, m = 0) => ctx({ now: Date.UTC(2026, 0, d, h - 8, m) });
		expect(matches(w, at(7, 10))).toBe(true);
		expect(matches(w, at(7, 9))).toBe(true);
		expect(matches(w, at(7, 8, 59))).toBe(false);
		expect(matches(w, at(7, 16, 59))).toBe(true);
		expect(matches(w, at(7, 17))).toBe(false);
		expect(matches(w, at(10, 10))).toBe(false);
	});
	it('Sunday is day 0', () => {
		const w = { time: { days: [0], start: '00:00', end: '23:59', tz: 'UTC' } };
		expect(matches(w, ctx({ now: Date.UTC(2026, 0, 4, 12) }))).toBe(true);
		expect(matches(w, ctx({ now: Date.UTC(2026, 0, 5, 12) }))).toBe(false);
	});
	it('handles an overnight window across DST changes', () => {
		const w = { time: { start: '22:00', end: '02:00', tz: 'America/New_York' } };
		// [year, month0, day, utcOffsetHours at that local time]
		const days: [number, number, number, number][] = [
			[2026, 5, 15, -4], // normal day
			[2026, 2, 8, -4], // spring forward: 23:30 and 21:59 are EDT, 01:30 is EST
			[2026, 10, 1, -4] // fall back day
		];
		const local = (y: number, mo: number, d: number, off: number, h: number, m: number) =>
			ctx({ now: Date.UTC(y, mo, d, h - off, m) });
		for (const [y, mo, d, off] of days) {
			expect(matches(w, local(y, mo, d, off, 23, 30))).toBe(true);
			expect(matches(w, local(y, mo, d, off, 21, 59))).toBe(false);
		}
		// Early-morning checks with the correct offset for each date.
		expect(matches(w, local(2026, 5, 15, -4, 1, 30))).toBe(true);
		expect(matches(w, local(2026, 5, 15, -4, 2, 0))).toBe(false);
		// 2026-03-08: 01:30 EST (UTC-5) exists; 02:00 EST == 03:00 EDT.
		expect(matches(w, local(2026, 2, 8, -5, 1, 30))).toBe(true);
		expect(matches(w, ctx({ now: Date.UTC(2026, 2, 8, 7, 0) }))).toBe(false); // 03:00 EDT
		// 2026-11-01: 01:30 EDT, then 01:30 EST again; 02:00 EST is out.
		expect(matches(w, ctx({ now: Date.UTC(2026, 10, 1, 5, 30) }))).toBe(true); // 01:30 EDT
		expect(matches(w, ctx({ now: Date.UTC(2026, 10, 1, 6, 30) }))).toBe(true); // 01:30 EST
		expect(matches(w, ctx({ now: Date.UTC(2026, 10, 1, 7, 0) }))).toBe(false); // 02:00 EST
	});
	it('overnight days refer to the day the window starts', () => {
		const w = { time: { days: [5], start: '22:00', end: '02:00', tz: 'UTC' } };
		expect(matches(w, ctx({ now: Date.UTC(2026, 0, 9, 23) }))).toBe(true); // Fri 23:00
		expect(matches(w, ctx({ now: Date.UTC(2026, 0, 10, 1) }))).toBe(true); // Sat 01:00
		expect(matches(w, ctx({ now: Date.UTC(2026, 0, 9, 1) }))).toBe(false); // Fri 01:00
	});
});

describe('parseRules', () => {
	const good = { id: 'a', when: { countries: ['SG'] }, destination: 'https://a.example/' };
	it('accepts empty and valid rules', () => {
		expect(ok([])).toEqual([]);
		const rules = ok([
			good,
			{
				id: 'b',
				when: {
					continents: ['AS'],
					devices: ['mobile'],
					os: ['ios'],
					referrerHosts: ['x.com'],
					time: { days: [1, 2], start: '09:00', end: '17:00', tz: 'Asia/Manila' }
				},
				destination: 'http://b.example/'
			},
			{
				id: 'c',
				when: {},
				split: [
					{ destination: 'https://a.example/', weight: 50 },
					{ destination: 'https://b.example/', weight: 50 }
				]
			}
		]);
		expect(rules).toHaveLength(3);
	});
	it('rejects non-arrays and non-objects', () => {
		expect(err({})).toMatch(/array/);
		expect(err([1])).toMatch(/^Rule 1:/);
	});
	it('rejects too many rules', () => {
		const many = Array.from({ length: MAX_RULES + 1 }, (_, i) => ({ ...good, id: `r${i}` }));
		expect(err(many)).toMatch(/at most 20/);
		expect(ok(many.slice(0, 20))).toHaveLength(20);
	});
	it('rejects duplicate ids', () => {
		expect(err([good, good])).toBe('Rule 2: id "a" is already used');
	});
	it('rejects bad ids', () => {
		expect(err([{ ...good, id: '' }])).toMatch(/^Rule 1: id/);
		expect(err([{ ...good, id: 5 }])).toMatch(/^Rule 1: id/);
	});
	it('rejects unknown keys', () => {
		expect(err([{ ...good, when: { colour: ['red'] } }])).toBe('Rule 1: unknown condition "colour"');
		expect(err([{ ...good, extra: 1 }])).toBe('Rule 1: unknown field "extra"');
	});
	it('rejects bad countries and continents', () => {
		expect(err([{ ...good, when: { continents: ['XX'] } }])).toMatch(/^Rule 1: continents/);
		expect(err([{ ...good, when: { countries: ['sg'] } }])).toMatch(/^Rule 1: countries/);
		expect(err([{ ...good, when: { countries: [] } }])).toMatch(/^Rule 1: countries/);
		expect(err([{ ...good, when: { devices: ['bot'] } }])).toMatch(/^Rule 1: devices/);
		expect(err([{ ...good, when: { os: ['beos'] } }])).toMatch(/^Rule 1: os/);
		expect(err([{ ...good, when: { referrerHosts: [''] } }])).toMatch(/^Rule 1: referrerHosts/);
	});
	it('rejects bad time conditions', () => {
		const t = { start: '09:00', end: '17:00', tz: 'Asia/Manila' };
		const bad = (time: unknown) => err([{ ...good, when: { time } }]);
		expect(bad({ ...t, tz: 'Mars/Base' })).toMatch(/^Rule 1: time\.tz/);
		expect(bad({ ...t, start: '25:00' })).toMatch(/^Rule 1: time\.start/);
		expect(bad({ ...t, end: '9:00' })).toMatch(/^Rule 1: time\.end/);
		expect(bad({ ...t, days: [7] })).toMatch(/^Rule 1: time\.days/);
		expect(bad({ ...t, days: [] })).toMatch(/^Rule 1: time\.days/);
		expect(bad({ ...t, start: '09:00', end: '09:00' })).toMatch(/^Rule 1: time/);
		expect(bad({ ...t, zone: 'x' })).toMatch(/^Rule 1: time/);
	});
	it('rejects bad splits', () => {
		const s = (split: unknown) => err([{ id: 'a', when: {}, split }]);
		const e = (w: number) => ({ destination: 'https://a.example/', weight: w });
		expect(s([e(100)])).toBe('Rule 1: split needs 2 to 5 entries');
		expect(s([e(1), e(1), e(1), e(1), e(1), e(95)])).toBe('Rule 1: split needs 2 to 5 entries');
		expect(s([e(50), e(49)])).toBe('Rule 1: weights must add up to 100');
		expect(s([e(100), e(0)])).toMatch(/^Rule 1: split weights/);
		expect(s([e(50.5), e(49.5)])).toMatch(/^Rule 1: split weights/);
		expect(s([e(50), { destination: 'ftp://x', weight: 50 }])).toMatch(/^Rule 1: split\[1\]/);
	});
	it('reports the rule position', () => {
		const split = [
			{ destination: 'https://a.example/', weight: 50 },
			{ destination: 'https://b.example/', weight: 49 }
		];
		expect(err([good, { id: 'x', when: {}, split }, good])).toBe(
			'Rule 2: weights must add up to 100'
		);
	});
	it('rejects bad destinations', () => {
		expect(err([{ ...good, destination: 'ftp://x' }])).toMatch(/^Rule 1: destination/);
		expect(err([{ ...good, destination: 'nope' }])).toMatch(/^Rule 1: destination/);
		const long = 'https://a.example/' + 'x'.repeat(2048);
		expect(err([{ ...good, destination: long }])).toMatch(/^Rule 1: destination/);
		const max = 'https://a.example/' + 'x'.repeat(2048 - 'https://a.example/'.length);
		expect(ok([{ ...good, destination: max }])).toHaveLength(1);
	});
	it('rejects both or neither of destination and split', () => {
		const split = [
			{ destination: 'https://a.example/', weight: 50 },
			{ destination: 'https://b.example/', weight: 50 }
		];
		expect(err([{ ...good, split }])).toBe('Rule 1: use either destination or split, not both');
		expect(err([{ id: 'a', when: {} }])).toBe('Rule 1: needs a destination or a split');
	});
	it('requires a when object', () => {
		expect(err([{ id: 'a', destination: 'https://a.example/' }])).toMatch(/^Rule 1: when/);
	});
});
