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
	'/fonts'
] as const;

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
	...RESERVED_FILES
];

export type PathClass =
	| { kind: 'root' }
	| { kind: 'reserved' }
	| { kind: 'slug'; slug: string; mode: 'redirect' | 'preview' | 'stats' }
	| { kind: 'unknown' };

const SLUG = /^[A-Za-z0-9_-]{1,64}$/;

function isReserved(pathname: string): boolean {
	if (pathname.startsWith(PROFILE_PREFIX)) return true;
	if ((RESERVED_FILES as readonly string[]).includes(pathname)) return true;
	return RESERVED_DIRECTORIES.some((dir) => pathname === dir || pathname.startsWith(dir + '/'));
}

export function classifyPath(pathname: string): PathClass {
	if (pathname === '/') return { kind: 'root' };
	if (isReserved(pathname)) return { kind: 'reserved' };

	const rest = pathname.slice(1);
	const plus = rest.indexOf('+');
	const slug = plus === -1 ? rest : rest.slice(0, plus);
	if (!SLUG.test(slug)) return { kind: 'unknown' };

	if (plus === -1) return { kind: 'slug', slug, mode: 'redirect' };
	const suffix = rest.slice(plus + 1);
	if (suffix === '') return { kind: 'slug', slug, mode: 'preview' };
	if (suffix === 'stats') return { kind: 'slug', slug, mode: 'stats' };
	return { kind: 'unknown' };
}
