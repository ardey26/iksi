export { classifyPath, RESERVED_PREFIXES, type PathClass } from './routing/path';
export {
	CANONICAL_HOST,
	normalizeHost,
	linkKey,
	parseLinkRecord,
	type LinkRecord,
	type StoredLink
} from './links/record';
export { parseClickEvent, type ClickEvent, type Surface } from './clicks/event';
export { surfaceFromQuery } from './clicks/surface';
export type { LinkLookup, LinkStore, EventSink } from './ports';
