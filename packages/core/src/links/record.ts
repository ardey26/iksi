export const CANONICAL_HOST = 'iksi.app';

const MAX_STRING = 2048;

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
}

/** A record as held in the store, with the time (ms epoch) it was written. */
export interface StoredLink {
	record: LinkRecord;
	storedAt: number;
}

function isHttpUrl(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > MAX_STRING) return false;
	try {
		const { protocol } = new URL(value);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

/** Hand-written (not zod) to keep the edge Worker bundle small. Unknown keys are dropped. */
export function parseLinkRecord(input: unknown): LinkRecord | null {
	if (typeof input !== 'object' || input === null) return null;
	const r = input as Record<string, unknown>;
	if (
		r.v !== 1 ||
		!(typeof r.id === 'number' && Number.isSafeInteger(r.id) && r.id > 0) ||
		!isHttpUrl(r.destination) ||
		typeof r.flagged !== 'boolean' ||
		typeof r.permanent !== 'boolean'
	) {
		return null;
	}
	return { v: 1, id: r.id, destination: r.destination, flagged: r.flagged, permanent: r.permanent };
}
