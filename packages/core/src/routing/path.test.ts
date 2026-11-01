import { classifyPath, parseScopedSlug, RESERVED_PREFIXES, scopedSlug } from './path';

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
	'/_edge/purge',
	'/media/7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp'
])('reserved %s', (p) => expect(classifyPath(p)).toEqual({ kind: 'reserved' }));

test('reserved prefixes match on segment boundaries', () => {
	expect(classifyPath('/apix')).toEqual({ kind: 'slug', slug: 'apix', mode: 'redirect' });
	expect(classifyPath('/mediax')).toEqual({ kind: 'slug', slug: 'mediax', mode: 'redirect' });
	expect(classifyPath('/loginx')).toEqual({ kind: 'slug', slug: 'loginx', mode: 'redirect' });
});

test('/media reserves only its subtree, so a link named media still resolves', () => {
	expect(classifyPath('/media')).toEqual({ kind: 'slug', slug: 'media', mode: 'redirect' });
	expect(classifyPath('/media+')).toEqual({ kind: 'slug', slug: 'media', mode: 'preview' });
	expect(classifyPath('/media/x')).toEqual({ kind: 'reserved' });
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

describe('profile-scoped links', () => {
	test('a single segment after /@ stays the profile page', () => {
		expect(classifyPath('/@andre')).toEqual({ kind: 'reserved' });
		expect(classifyPath('/@andre/')).toEqual({ kind: 'reserved' });
	});

	test('a name under a handle is a scoped link keyed by its stored name', () => {
		expect(classifyPath('/@andre/sale')).toEqual({
			kind: 'scoped',
			handle: 'andre',
			name: 'sale',
			slug: '@andre/sale',
			mode: 'redirect'
		});
		expect(classifyPath('/@andre/sale+')).toMatchObject({ kind: 'scoped', slug: '@andre/sale', mode: 'preview' });
		expect(classifyPath('/@andre/sale+stats')).toMatchObject({ kind: 'scoped', mode: 'stats' });
	});

	test('the handle is case-insensitive, the name keeps its case', () => {
		expect(classifyPath('/@AnDre/Sale')).toMatchObject({ kind: 'scoped', handle: 'andre', name: 'Sale', slug: '@andre/Sale' });
	});

	test('a name the app would reserve at the top level is fine under a handle', () => {
		expect(classifyPath('/@andre/dashboard')).toMatchObject({ kind: 'scoped', slug: '@andre/dashboard' });
	});

	test.each(['/@andre/a/b', '/@andre/a b', '/@andre/+', '/@andre/a+x', '/@ab/sale', '/@' + 'a'.repeat(31) + '/sale'])(
		'not a scoped link: %s',
		(p) => expect(classifyPath(p).kind).not.toBe('scoped')
	);

	test('scopedSlug builds the stored name with a lowercase handle', () => {
		expect(scopedSlug('Andre', 'Sale')).toBe('@andre/Sale');
	});

	test('parseScopedSlug reads a requested scoped name', () => {
		expect(parseScopedSlug('@Andre/sale')).toEqual({ handle: 'andre', name: 'sale' });
		expect(parseScopedSlug('@andre/sale/x')).toBeNull();
		expect(parseScopedSlug('@andre/')).toBeNull();
		expect(parseScopedSlug('andre/sale')).toBeNull();
		expect(parseScopedSlug('@andre/sa le')).toBeNull();
	});
});
