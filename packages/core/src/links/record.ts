import { isDbId } from '../ids';
import { isHttpUrl } from './url';
import { parseRules, type Rule } from '../routing/rules';

export const CANONICAL_HOST = 'iksi.app';

/** Lowercases, strips any port and a leading `www.` so every alias keys to one host. */
export function normalizeHost(host: string): string {
	const bare = host.trim().toLowerCase().replace(/:\d+$/, '');
	return bare.startsWith('www.') ? bare.slice(4) : bare;
}

/** KV key for a link. The host is normalized; the slug is kept byte-exact (case-sensitive). */
export function linkKey(host: string, slug: string): string {
	return `link:${normalizeHost(host)}:${slug}`;
}

export interface LinkRecord {
	v: 1;
	id: number;
	destination: string;
	flagged: boolean;
	permanent: boolean;
	rules?: Rule[];
	expiresAt?: number | null;
	expired?: boolean;
	protected?: boolean;
}

export type LinkDecision = 'redirect' | 'protected' | 'expired' | 'flagged';

/** Order matters: flagged, then expired, then protected, else redirect. */
export function decideLink(record: LinkRecord, now: number): LinkDecision {
	if (record.flagged) return 'flagged';
	if (record.expired || (record.expiresAt != null && record.expiresAt <= now)) return 'expired';
	if (record.protected) return 'protected';
	return 'redirect';
}

/** A record as held in the store, with the time (ms epoch) it was written. */
export interface StoredLink {
	record: LinkRecord;
	storedAt: number;
}

/** Hand-written (not zod) to keep the edge Worker bundle small. Unknown keys are dropped. */
export function parseLinkRecord(input: unknown): LinkRecord | null {
	if (typeof input !== 'object' || input === null) return null;
	const r = input as Record<string, unknown>;
	if (
		r.v !== 1 ||
		!isDbId(r.id) ||
		!isHttpUrl(r.destination) ||
		typeof r.flagged !== 'boolean' ||
		typeof r.permanent !== 'boolean'
	) {
		return null;
	}
	const optBool = (x: unknown) => x === undefined || typeof x === 'boolean';
	if (
		!optBool(r.expired) ||
		!optBool(r.protected) ||
		(r.expiresAt !== undefined &&
			r.expiresAt !== null &&
			(typeof r.expiresAt !== 'number' || !Number.isFinite(r.expiresAt)))
	) {
		return null;
	}
	const record: LinkRecord = {
		v: 1,
		id: r.id,
		destination: r.destination,
		flagged: r.flagged,
		permanent: r.permanent
	};
	// Stored rules are untrusted; a bad set must not break redirects, so fall back to none.
	if (r.rules !== undefined) {
		const parsed = parseRules(r.rules);
		record.rules = parsed.ok ? parsed.rules : [];
	}
	if (r.expiresAt !== undefined) record.expiresAt = r.expiresAt as number | null;
	if (r.expired !== undefined) record.expired = r.expired as boolean;
	if (r.protected !== undefined) record.protected = r.protected as boolean;
	return record;
}
