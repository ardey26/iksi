import { classifyPath, RESERVED_PREFIXES } from './path';

test('root', () => expect(classifyPath('/')).toEqual({ kind: 'root' }));

test.each([
	'/@andre',
	'/api',
	'/api/shorten',
	'/auth/google/callback',
	'/login',
	'/_app/immutable/x.js',
	'/robots.txt',
	'/sitemap.xml',
	'/favicon.png',
	'/fonts/geist.woff2',
	'/manifest.json',
	'/_health',
	'/admin',
	'/internal',
	'/internal/resolve',
	'/_edge/purge'
])('reserved %s', (p) => expect(classifyPath(p)).toEqual({ kind: 'reserved' }));

test('reserved prefixes match on segment boundaries', () => {
	expect(classifyPath('/apix')).toEqual({ kind: 'slug', slug: 'apix', mode: 'redirect' });
	expect(classifyPath('/loginx')).toEqual({ kind: 'slug', slug: 'loginx', mode: 'redirect' });
});

test('slug modes', () => {
	expect(classifyPath('/QdM2whH')).toEqual({ kind: 'slug', slug: 'QdM2whH', mode: 'redirect' });
	expect(classifyPath('/QdM2whH+')).toEqual({ kind: 'slug', slug: 'QdM2whH', mode: 'preview' });
	expect(classifyPath('/QdM2whH+stats')).toEqual({ kind: 'slug', slug: 'QdM2whH', mode: 'stats' });
});

test('case is preserved', () => expect(classifyPath('/AbC')).toMatchObject({ slug: 'AbC' }));

test.each(['/abc/', '/abc/def', '/a b', '/abc%2F', '/' + 'a'.repeat(65), '/abc+other', '/+'])(
	'not a slug: %s',
	(p) => expect(classifyPath(p)).toEqual({ kind: 'unknown' })
);

test('every reserved prefix starts with a slash', () =>
	RESERVED_PREFIXES.forEach((p) => expect(p.startsWith('/')).toBe(true)));
