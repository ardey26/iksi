export {
	classifyPath,
	parseScopedSlug,
	RESERVED_PREFIXES,
	scopedSlug,
	type PathClass,
	type SlugMode
} from './routing/path';
export {
	CANONICAL_HOST,
	normalizeHost,
	linkKey,
	LINK_RECORD_VERSION,
	parseLinkRecord,
	decideLink,
	type LinkDecision,
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
export {
	MAX_RULES,
	parseRules,
	matches,
	resolveDestination,
	type Conditions,
	type Rule,
	type RequestContext
} from './routing/rules';
export { httpUrlError, isHttpUrl, MAX_URL_LENGTH } from './links/url';
