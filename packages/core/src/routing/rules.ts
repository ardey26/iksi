import { normalizeHost } from '../links/record';
import { httpUrlError } from '../links/url';
import type { Device, Os } from './agent';
import type { Continent } from './continent';

export const MAX_RULES = 20;
const MAX_REFERRER_HOSTS = 50;
const ID_RE = /^[A-Za-z0-9_-]{8}$/;

export interface Conditions {
	countries?: string[];
	continents?: Continent[];
	devices?: Device[];
	os?: Os[];
	referrerHosts?: string[];
	time?: { days?: number[]; start: string; end: string; tz: string };
}

export type Rule =
	| { id: string; when: Conditions; destination: string }
	| { id: string; when: Conditions; split: { destination: string; weight: number }[] };

export interface RequestContext {
	country: string | null;
	continent: Continent | null;
	device: Device | 'bot';
	os: Os;
	referrerHost: string | null;
	now: number;
}

const CONTINENTS: readonly string[] = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'];
const DEVICES: readonly string[] = ['mobile', 'desktop', 'tablet'];
const OSES: readonly string[] = ['ios', 'android', 'windows', 'macos', 'linux', 'other'];
const CONDITION_KEYS = ['countries', 'continents', 'devices', 'os', 'referrerHosts', 'time'];
const RULE_KEYS = ['id', 'when', 'destination', 'split'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

// Filled lazily so importing the module has no side effects. Constructing a formatter is the slow part.
const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(tz: string): Intl.DateTimeFormat | null {
	let f = formatters.get(tz);
	if (f === undefined) {
		try {
			f = new Intl.DateTimeFormat('en-US', {
				timeZone: tz,
				hour: '2-digit',
				minute: '2-digit',
				weekday: 'short',
				hourCycle: 'h23'
			});
		} catch {
			f = null;
		}
		formatters.set(tz, f);
	}
	return f;
}

function stringList(value: unknown, allowed: (s: string) => boolean): string[] | null {
	if (!Array.isArray(value) || value.length === 0) return null;
	for (const v of value) if (typeof v !== 'string' || !allowed(v)) return null;
	return value as string[];
}

function parseConditions(raw: unknown): Result<Conditions> {
	if (!isObject(raw)) return { ok: false, error: 'when must be an object' };
	for (const key of Object.keys(raw)) {
		if (!CONDITION_KEYS.includes(key)) return { ok: false, error: `unknown condition "${key}"` };
	}
	const when: Conditions = {};

	if (raw.countries !== undefined) {
		const v = stringList(raw.countries, (s) => /^[A-Z]{2}$/.test(s));
		if (!v) return { ok: false, error: 'countries must be a list of upper-case 2-letter codes' };
		when.countries = v;
	}
	if (raw.continents !== undefined) {
		const v = stringList(raw.continents, (s) => CONTINENTS.includes(s));
		if (!v) return { ok: false, error: `continents must be a list of ${CONTINENTS.join(', ')}` };
		when.continents = v as Continent[];
	}
	if (raw.devices !== undefined) {
		const v = stringList(raw.devices, (s) => DEVICES.includes(s));
		if (!v) return { ok: false, error: `devices must be a list of ${DEVICES.join(', ')}` };
		when.devices = v as Device[];
	}
	if (raw.os !== undefined) {
		const v = stringList(raw.os, (s) => OSES.includes(s));
		if (!v) return { ok: false, error: `os must be a list of ${OSES.join(', ')}` };
		when.os = v as Os[];
	}
	if (raw.referrerHosts !== undefined) {
		if (Array.isArray(raw.referrerHosts) && raw.referrerHosts.length > MAX_REFERRER_HOSTS) {
			return { ok: false, error: `at most ${MAX_REFERRER_HOSTS} referrer hosts` };
		}
		const v = stringList(
			raw.referrerHosts,
			(s) => s.length > 0 && s.length <= 253 && !/[\s/:@?#]/.test(s)
		);
		if (!v) return { ok: false, error: 'referrerHosts must be a list of host names' };
		when.referrerHosts = v.map(normalizeHost);
	}
	if (raw.time !== undefined) {
		const t = raw.time;
		if (!isObject(t)) return { ok: false, error: 'time must be an object' };
		for (const key of Object.keys(t)) {
			if (!['days', 'start', 'end', 'tz'].includes(key)) {
				return { ok: false, error: `time: unknown field "${key}"` };
			}
		}
		if (typeof t.start !== 'string' || !TIME_RE.test(t.start)) {
			return { ok: false, error: 'time.start must be HH:MM (24-hour)' };
		}
		if (typeof t.end !== 'string' || !TIME_RE.test(t.end)) {
			return { ok: false, error: 'time.end must be HH:MM (24-hour)' };
		}
		if (t.start === t.end) return { ok: false, error: 'time: start and end must differ' };
		if (typeof t.tz !== 'string' || !formatterFor(t.tz)) {
			return { ok: false, error: 'time.tz must be an IANA time zone' };
		}
		const time: NonNullable<Conditions['time']> = { start: t.start, end: t.end, tz: t.tz };
		if (t.days !== undefined) {
			const d = t.days;
			if (
				!Array.isArray(d) ||
				d.length === 0 ||
				d.length > 7 ||
				!d.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
			) {
				return { ok: false, error: 'time.days must be a list of 0 (Sunday) to 6 (Saturday)' };
			}
			time.days = d as number[];
		}
		when.time = time;
	}
	return { ok: true, value: when };
}

function parseRule(raw: unknown, seen: Set<string>): Result<Rule> {
	if (!isObject(raw)) return { ok: false, error: 'must be an object' };
	for (const key of Object.keys(raw)) {
		if (!RULE_KEYS.includes(key)) return { ok: false, error: `unknown field "${key}"` };
	}
	const id = raw.id;
	if (typeof id !== 'string' || !ID_RE.test(id)) {
		return { ok: false, error: 'id must be 8 letters, digits, _ or -' };
	}
	if (seen.has(id)) return { ok: false, error: `id "${id}" is already used` };
	seen.add(id);

	const when = parseConditions(raw.when);
	if (!when.ok) return when;

	const hasDest = raw.destination !== undefined;
	const hasSplit = raw.split !== undefined;
	if (hasDest && hasSplit) return { ok: false, error: 'use either destination or split, not both' };
	if (!hasDest && !hasSplit) return { ok: false, error: 'needs a destination or a split' };

	if (hasDest) {
		const e = httpUrlError(raw.destination);
		if (e) return { ok: false, error: `destination ${e}` };
		return { ok: true, value: { id, when: when.value, destination: raw.destination as string } };
	}

	const s = raw.split;
	if (!Array.isArray(s) || s.length < 2 || s.length > 5) {
		return { ok: false, error: 'split needs 2 to 5 entries' };
	}
	const split: { destination: string; weight: number }[] = [];
	let total = 0;
	for (let i = 0; i < s.length; i++) {
		const entry: unknown = s[i];
		if (!isObject(entry)) return { ok: false, error: `split[${i}] must be an object` };
		for (const key of Object.keys(entry)) {
			if (key !== 'destination' && key !== 'weight') {
				return { ok: false, error: `split[${i}]: unknown field "${key}"` };
			}
		}
		const e = httpUrlError(entry.destination);
		if (e) return { ok: false, error: `split[${i}] destination ${e}` };
		const w = entry.weight;
		if (typeof w !== 'number' || !Number.isInteger(w) || w < 1 || w > 100) {
			return { ok: false, error: `split weights must be whole numbers from 1 to 100 (entry ${i})` };
		}
		total += w;
		split.push({ destination: entry.destination as string, weight: w });
	}
	if (total !== 100) return { ok: false, error: 'weights must add up to 100' };
	return { ok: true, value: { id, when: when.value, split } };
}

/** Validate untrusted rules JSON. Errors name the 1-based rule position and the field at fault. */
export function parseRules(
	input: unknown
): { ok: true; rules: Rule[] } | { ok: false; error: string } {
	if (!Array.isArray(input)) return { ok: false, error: 'Rules must be an array' };
	if (input.length > MAX_RULES) return { ok: false, error: `Use at most ${MAX_RULES} rules` };
	const seen = new Set<string>();
	const rules: Rule[] = [];
	for (let i = 0; i < input.length; i++) {
		const r = parseRule(input[i], seen);
		if (!r.ok) return { ok: false, error: `Rule ${i + 1}: ${r.error}` };
		rules.push(r.value);
	}
	return { ok: true, rules };
}

// Input is validated as HH:MM by parseRules, so read the digits directly without allocating.
function toMinutes(hhmm: string): number {
	const d = (i: number) => hhmm.charCodeAt(i) - 48;
	return (d(0) * 10 + d(1)) * 60 + d(3) * 10 + d(4);
}

function inTimeWindow(time: NonNullable<Conditions['time']>, now: number): boolean {
	const fmt = formatterFor(time.tz);
	if (!fmt) return false;
	let hour = 0;
	let minute = 0;
	let day = 0;
	for (const p of fmt.formatToParts(new Date(now))) {
		if (p.type === 'hour') hour = Number(p.value) % 24;
		else if (p.type === 'minute') minute = Number(p.value);
		else if (p.type === 'weekday') day = WEEKDAYS.indexOf(p.value);
	}
	const mins = hour * 60 + minute;
	const start = toMinutes(time.start);
	const end = toMinutes(time.end);
	const overnight = start > end;
	const inside = overnight ? mins >= start || mins < end : mins >= start && mins < end;
	if (!inside) return false;
	if (!time.days) return true;
	// An overnight window belongs to the day it starts on, so its after-midnight part counts as the previous day.
	const owner = overnight && mins < end ? (day + 6) % 7 : day;
	return time.days.includes(owner);
}

/** Every condition present must match; an empty `when` always matches. */
export function matches(when: Conditions, ctx: RequestContext): boolean {
	if (when.countries && !(ctx.country && when.countries.includes(ctx.country))) return false;
	if (when.continents && !(ctx.continent && when.continents.includes(ctx.continent))) return false;
	if (when.devices && (ctx.device === 'bot' || !when.devices.includes(ctx.device))) return false;
	if (when.os && !when.os.includes(ctx.os)) return false;
	if (when.referrerHosts) {
		// Rule hosts are normalized by parseRules.
		const host = ctx.referrerHost ? normalizeHost(ctx.referrerHost) : null;
		if (!host) return false;
		if (!when.referrerHosts.some((h) => host === h || host.endsWith('.' + h))) return false;
	}
	if (when.time && !inTimeWindow(when.time, ctx.now)) return false;
	return true;
}

/** First matching rule wins. Splits walk cumulative weights against floor(random() * 100). */
export function resolveDestination(
	defaultDestination: string,
	rules: Rule[],
	ctx: RequestContext,
	random: () => number
): { destination: string; ruleId: string | null } {
	for (const rule of rules) {
		if (!matches(rule.when, ctx)) continue;
		if ('destination' in rule) return { destination: rule.destination, ruleId: rule.id };
		const roll = Math.floor(random() * 100);
		let cumulative = 0;
		for (const entry of rule.split) {
			cumulative += entry.weight;
			if (roll < cumulative) return { destination: entry.destination, ruleId: rule.id };
		}
		return { destination: rule.split[rule.split.length - 1].destination, ruleId: rule.id };
	}
	return { destination: defaultDestination, ruleId: null };
}
