import { z } from 'zod';

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

const httpUrl = z
	.string()
	.max(MAX_STRING)
	.refine((value) => {
		try {
			const { protocol } = new URL(value);
			return protocol === 'http:' || protocol === 'https:';
		} catch {
			return false;
		}
	});

const linkRecordSchema = z.object({
	v: z.literal(1),
	id: z.number().int().positive(),
	destination: httpUrl,
	flagged: z.boolean(),
	permanent: z.boolean()
});

export function parseLinkRecord(input: unknown): LinkRecord | null {
	const result = linkRecordSchema.safeParse(input);
	return result.success ? result.data : null;
}
