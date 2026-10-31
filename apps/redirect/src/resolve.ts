import { parseLinkRecord, type LinkLookup, type LinkRecord, type LinkStore } from '@iksi/core';
import type { Upstream } from './handler';
import { internalHeaders } from './auth';

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
	/** Hands best-effort work (store writes) to the caller; in the Worker, `ctx.waitUntil`. */
	defer: (work: Promise<unknown>) => void;
}

type OriginAnswer =
	| { kind: 'found'; record: LinkRecord }
	| { kind: 'missing' }
	| { kind: 'unavailable' };

async function askOrigin(slug: string, deps: ResolveDeps): Promise<OriginAnswer> {
	try {
		const res = await deps.upstream(
			new Request(`${deps.origin}/internal/resolve?slug=${encodeURIComponent(slug)}`, {
				headers: internalHeaders(deps.secret)
			})
		);
		if (res.status === 404) return { kind: 'missing' };
		if (res.status !== 200) return { kind: 'unavailable' };
		const body = (await res.json()) as {
			found?: unknown;
			record?: unknown;
		} | null;
		const record = body?.found === true ? parseLinkRecord(body.record) : null;
		return record ? { kind: 'found', record } : { kind: 'unavailable' };
	} catch (error) {
		console.error(`origin resolve failed for slug ${slug}`, error);
		return { kind: 'unavailable' };
	}
}

/** Store writes must never break a redirect: log and move on. */
function bestEffort(slug: string, what: string, write: () => Promise<void>): Promise<void> {
	return write().catch((error) => console.error(`store ${what} failed for slug ${slug}`, error));
}

/** Store first; on a true unknown, ask origin and remember the answer. */
export async function resolveLink(
	host: string,
	slug: string,
	store: LinkStore,
	deps: ResolveDeps
): Promise<Resolution> {
	let lookup: LinkLookup;
	try {
		lookup = await store.get(host, slug);
	} catch (error) {
		console.error(`store get failed for slug ${slug}`, error);
		lookup = { kind: 'unknown' };
	}
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
		deps.defer(
			bestEffort(slug, 'putFound', () => store.putFound(host, slug, answer.record, deps.now))
		);
		return { kind: 'found', record: answer.record, stale: false };
	}
	if (answer.kind === 'missing') {
		deps.defer(bestEffort(slug, 'putMissing', () => store.putMissing(host, slug)));
	}
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
		await bestEffort(slug, 'putFound', () => store.putFound(host, slug, answer.record, deps.now));
	} else if (answer.kind === 'missing') {
		await bestEffort(slug, 'refresh delete', async () => {
			await store.delete(host, slug);
			await store.putMissing(host, slug);
		});
	}
}
