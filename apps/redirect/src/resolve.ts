import { parseLinkRecord, type LinkRecord, type LinkStore } from '@iksi/core';
import type { Upstream } from './handler';

/** Found entries older than this are served, then re-checked against origin in the background. */
export const STALE_AFTER_MS = 3_600_000;

export type Resolution =
	| { kind: 'found'; record: LinkRecord; stale: boolean }
	| { kind: 'missing' }
	| { kind: 'unavailable' };

interface ResolveDeps {
	upstream: Upstream;
	origin: string;
	secret: string | undefined;
	now: number;
}

type OriginAnswer =
	| { kind: 'found'; record: LinkRecord }
	| { kind: 'missing' }
	| { kind: 'unavailable' };

async function askOrigin(slug: string, deps: ResolveDeps): Promise<OriginAnswer> {
	try {
		const headers = new Headers();
		if (deps.secret) headers.set('x-iksi-edge', deps.secret);
		const res = await deps.upstream(
			new Request(`${deps.origin}/internal/resolve?slug=${encodeURIComponent(slug)}`, { headers })
		);
		if (res.status === 404) return { kind: 'missing' };
		if (res.status !== 200) return { kind: 'unavailable' };
		const body = (await res.json()) as {
			found?: unknown;
			record?: unknown;
		} | null;
		const record = body?.found === true ? parseLinkRecord(body.record) : null;
		return record ? { kind: 'found', record } : { kind: 'unavailable' };
	} catch {
		return { kind: 'unavailable' };
	}
}

/** Store first; on a true unknown, ask origin and remember the answer. */
export async function resolveLink(
	host: string,
	slug: string,
	store: LinkStore,
	deps: ResolveDeps
): Promise<Resolution> {
	const lookup = await store.get(host, slug);
	if (lookup.kind === 'found') {
		return {
			kind: 'found',
			record: lookup.stored.record,
			stale: deps.now - lookup.stored.storedAt > STALE_AFTER_MS
		};
	}
	if (lookup.kind === 'missing') return { kind: 'missing' };

	const answer = await askOrigin(slug, deps);
	if (answer.kind === 'found') {
		await store.putFound(host, slug, answer.record, deps.now);
		return { kind: 'found', record: answer.record, stale: false };
	}
	if (answer.kind === 'missing') await store.putMissing(host, slug);
	return answer;
}

/** Background re-check of a stale entry. Origin trouble leaves the entry as it was. */
export async function refreshLink(
	host: string,
	slug: string,
	store: LinkStore,
	deps: ResolveDeps
): Promise<void> {
	const answer = await askOrigin(slug, deps);
	if (answer.kind === 'found') {
		await store.putFound(host, slug, answer.record, deps.now);
	} else if (answer.kind === 'missing') {
		await store.delete(host, slug);
		await store.putMissing(host, slug);
	}
}
