import type { ClickEvent } from './clicks/event';
import type { LinkRecord, StoredLink } from './links/record';

export type LinkLookup =
	| { kind: 'found'; stored: StoredLink }
	| { kind: 'missing' }
	| { kind: 'unknown' };

export interface LinkStore {
	get(host: string, slug: string): Promise<LinkLookup>;
	putFound(host: string, slug: string, record: LinkRecord, now: number): Promise<void>;
	putMissing(host: string, slug: string): Promise<void>;
	delete(host: string, slug: string): Promise<void>;
}

export interface EventSink {
	emit(event: ClickEvent): Promise<void>;
}
