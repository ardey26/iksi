// Which route files can answer a path, following SvelteKit's matching rules
// for the param kinds this app uses: (group), [param], [...rest], @[param].
import { describe, expect, it } from 'vitest';

const files = Object.keys(import.meta.glob('./**/+{page,server}.{svelte,ts,js}'));

function routeOf(file: string): string {
	const segs = file.split('/').slice(1, -1).filter((s) => !/^\(.+\)$/.test(s));
	return '/' + segs.join('/');
}

function matcher(route: string): RegExp {
	if (route === '/') return /^\/$/;
	const body = route
		.split('/')
		.slice(1)
		.map((seg) => {
			if (/^\[\.\.\.[^\]]+\]$/.test(seg)) return '(?:/.*)?';
			const parts = seg.split(/(\[[^\]]+\])/).filter(Boolean);
			return '/' + parts.map((p) => (p.startsWith('[') ? '[^/]+' : p.replace(/[.*+?^${}()|\\]/g, '\\$&'))).join('');
		})
		.join('');
	return new RegExp(`^${body}$`);
}

function routesMatching(path: string): string[] {
	return [...new Set(files.map(routeOf))].filter((r) => matcher(r).test(path)).sort();
}

describe('route ownership', () => {
	it('sees the app routes', () => {
		expect(files.length).toBeGreaterThan(10);
		expect(files.map(routeOf)).toContain('/[slug]');
	});

	it('leaves a bare /media to the short-link route', () => {
		expect(routesMatching('/media')).toEqual(['/[slug]']);
		expect(routesMatching('/media/')).toEqual([]);
	});

	it('serves image keys only from the media route', () => {
		expect(routesMatching('/media/7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp')).toEqual([
			'/media/[uid]/[kind]/[file]'
		]);
	});
});
