/**
 * Splits `iksi.app/*` traffic between the edge redirect path and the app origin.
 * The reserved list doubles as the reserved-slug list: no short link may use
 * a path the app owns.
 */

/** Paths that own a whole subtree: `/api` and `/api/...` are reserved, `/apix` is not. */
const RESERVED_DIRECTORIES = [
	'/api',
	'/auth',
	'/login',
	'/logout',
	'/dashboard',
	'/admin',
	'/_app',
	'/fonts',
	'/internal',
	'/_edge'
] as const;

/**
 * Paths that own only what is below them: `/media/...` is reserved, `/media`
 * itself stays a slug so a short link named media keeps resolving.
 */
const RESERVED_SUBTREES = ['/media'] as const;

/** Single files served by the app; matched on equality only. */
const RESERVED_FILES = [
	'/robots.txt',
	'/sitemap.xml',
	'/favicon.svg',
	'/favicon.png',
	'/manifest.json',
	'/_health',
	'/og-image.png',
	'/service-worker.js'
] as const;

/** Profile pages: anything starting with `/@`. */
const PROFILE_PREFIX = '/@';

export const RESERVED_PREFIXES: readonly string[] = [
	PROFILE_PREFIX,
	...RESERVED_DIRECTORIES,
	...RESERVED_SUBTREES.map((dir) => dir + '/'),
	...RESERVED_FILES
];

export type SlugMode = 'redirect' | 'preview' | 'stats';

export type PathClass =
	| { kind: 'root' }
	| { kind: 'reserved' }
	| { kind: 'slug'; slug: string; mode: SlugMode }
	/**
	 * `/@handle/name`: a link in its owner's namespace. `slug` is the stored
	 * short name, `@handle/name`, with the handle lowercased.
	 */
	| { kind: 'scoped'; slug: string; handle: string; name: string; mode: SlugMode }
	| { kind: 'unknown' };

const SLUG = /^[A-Za-z0-9_-]{1,64}$/;

/** Same shape as a claimed handle (see validateHandle in the app), in any case. */
const SCOPED = /^@([A-Za-z0-9_-]{3,30})\/([^/]+)$/;

/** The stored short name of `name` under `handle`. */
export const scopedSlug = (handle: string, name: string): string => `@${handle.toLowerCase()}/${name}`;

/** Reads `@handle/name`. Null for anything else, including a name that could not be a slug. */
export function parseScopedSlug(value: string): { handle: string; name: string } | null {
	const m = SCOPED.exec(value);
	if (!m || !SLUG.test(m[2])) return null;
	return { handle: m[1].toLowerCase(), name: m[2] };
}

/** Splits `name`, `name+` and `name+stats`. Null when it is none of them. */
function slugAndMode(rest: string): { slug: string; mode: SlugMode } | null {
	const plus = rest.indexOf('+');
	const slug = plus === -1 ? rest : rest.slice(0, plus);
	if (!SLUG.test(slug)) return null;
	if (plus === -1) return { slug, mode: 'redirect' };
	const suffix = rest.slice(plus + 1);
	if (suffix === '') return { slug, mode: 'preview' };
	if (suffix === 'stats') return { slug, mode: 'stats' };
	return null;
}

function isReserved(pathname: string): boolean {
	if (pathname.startsWith(PROFILE_PREFIX)) return true;
	if ((RESERVED_FILES as readonly string[]).includes(pathname)) return true;
	if (RESERVED_SUBTREES.some((dir) => pathname.startsWith(dir + '/'))) return true;
	return RESERVED_DIRECTORIES.some((dir) => pathname === dir || pathname.startsWith(dir + '/'));
}

export function classifyPath(pathname: string): PathClass {
	if (pathname === '/') return { kind: 'root' };

	// `/@handle` is the profile page; one more segment is a link in its namespace.
	const scoped = SCOPED.exec(pathname.slice(1));
	if (scoped) {
		const parsed = slugAndMode(scoped[2]);
		if (!parsed) return { kind: 'unknown' };
		const handle = scoped[1].toLowerCase();
		return { kind: 'scoped', slug: scopedSlug(handle, parsed.slug), handle, name: parsed.slug, mode: parsed.mode };
	}

	if (isReserved(pathname)) return { kind: 'reserved' };

	const parsed = slugAndMode(pathname.slice(1));
	return parsed ? { kind: 'slug', ...parsed } : { kind: 'unknown' };
}
