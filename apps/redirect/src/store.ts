import { linkKey, parseLinkRecord, type LinkLookup, type LinkStore } from '@iksi/core';

const MISSING = 'missing';
const TTL_SECONDS = 60;

/** Link cache on Workers KV. Found entries never expire; "missing" entries live 60s. */
export function kvLinkStore(kv: KVNamespace): LinkStore {
	return {
		async get(host, slug): Promise<LinkLookup> {
			const raw = await kv.get(linkKey(host, slug), { cacheTtl: TTL_SECONDS });
			if (raw === null) return { kind: 'unknown' };
			if (raw === MISSING) return { kind: 'missing' };
			return parseStored(raw);
		},
		async putFound(host, slug, record, now) {
			await kv.put(linkKey(host, slug), JSON.stringify({ record, storedAt: now }));
		},
		async putMissing(host, slug) {
			await kv.put(linkKey(host, slug), MISSING, { expirationTtl: TTL_SECONDS });
		},
		async delete(host, slug) {
			await kv.delete(linkKey(host, slug));
		}
	};
}

/** Anything unparseable is `unknown` so the caller re-resolves instead of failing. */
function parseStored(raw: string): LinkLookup {
	try {
		const value = JSON.parse(raw) as { record?: unknown; storedAt?: unknown } | null;
		const record = parseLinkRecord(value?.record);
		if (!record || typeof value?.storedAt !== 'number') return { kind: 'unknown' };
		return { kind: 'found', stored: { record, storedAt: value.storedAt } };
	} catch {
		return { kind: 'unknown' };
	}
}
