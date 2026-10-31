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
export { isDbId, MAX_DB_ID } from './ids';
export type { LinkLookup, LinkStore, EventSink } from './ports';
export {
	parseUserAgent,
	referrerHost,
	type AgentInfo,
	type Device,
	type Os
} from './routing/agent';
export { continentOf, type Continent } from './routing/continent';
